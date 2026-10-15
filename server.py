"""API demostrativa EMAPA: SQLite, sesiones por rol y eventos de stock en vivo."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import queue
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("EMAPA_DB_PATH", ROOT / "database" / "emapa.sqlite3"))
SESSION_COOKIE = "emapa_session"
SESSION_SECONDS = 8 * 60 * 60
PASSWORD_ITERATIONS = 310_000
MAX_BODY_BYTES = 64 * 1024
LIVE_CLIENTS: set[queue.Queue[dict[str, str]]] = set()
LIVE_LOCK = Lock()
LOGIN_ATTEMPTS: dict[str, list[float]] = {}
LOGIN_LOCK = Lock()
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/api-client.js": ("api-client.js", "text/javascript; charset=utf-8"),
    "/emapa-config.js": ("emapa-config.js", "text/javascript; charset=utf-8"),
}


def configured_origins() -> set[str]:
    return {
        origin.strip().rstrip("/")
        for origin in os.environ.get("EMAPA_CORS_ORIGINS", "").split(",")
        if origin.strip()
    }


def load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


@contextmanager
def db_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    try:
        yield connection
    finally:
        connection.close()


def initialize_db() -> None:
    with db_connection() as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript((ROOT / "database" / "schema.sql").read_text(encoding="utf-8"))
        db.executemany(
            "INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)",
            [("warehouse", "Almacenero"), ("supervisor", "Supervisor"), ("auditor", "Auditor")],
        )
        branches = json.loads((ROOT / "data" / "branches.json").read_text(encoding="utf-8"))
        db.executemany(
            "INSERT OR IGNORE INTO branches (id,name,city,address,latitude,longitude) VALUES (?,?,?,?,?,?)",
            [(b["id"], b["name"], b["city"], b["address"], b["lat"], b["lng"]) for b in branches],
        )
        products = json.loads((ROOT / "data" / "products.json").read_text(encoding="utf-8"))
        db.executemany(
            "INSERT OR IGNORE INTO products (id,name,unit,category) VALUES (?,?,?,?)",
            [(p["id"], p["name"], p["unit"], p["category"]) for p in products],
        )
        bootstrap_accounts = [
            ("EMAPA_ADMIN_USERNAME", "EMAPA_ADMIN_PASSWORD", "supervisor"),
            ("EMAPA_WAREHOUSE_USERNAME", "EMAPA_WAREHOUSE_PASSWORD", "warehouse"),
            ("EMAPA_WAREHOUSE_2_USERNAME", "EMAPA_WAREHOUSE_2_PASSWORD", "warehouse"),
            ("EMAPA_WAREHOUSE_3_USERNAME", "EMAPA_WAREHOUSE_3_PASSWORD", "warehouse"),
            ("EMAPA_WAREHOUSE_4_USERNAME", "EMAPA_WAREHOUSE_4_PASSWORD", "warehouse"),
            ("EMAPA_WAREHOUSE_5_USERNAME", "EMAPA_WAREHOUSE_5_PASSWORD", "warehouse"),
            ("EMAPA_AUDITOR_USERNAME", "EMAPA_AUDITOR_PASSWORD", "auditor"),
        ]
        for username_key, password_key, role_id in bootstrap_accounts:
            username = os.environ.get(username_key, "").strip()
            password = os.environ.get(password_key, "")
            if bool(username) != bool(password):
                raise RuntimeError(f"Configura ambas variables {username_key} y {password_key}, o deja ambas vacías.")
            if not username:
                continue
            if len(password) < 12:
                raise RuntimeError(f"{password_key} debe tener al menos 12 caracteres.")
            if db.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone() is None:
                salt = secrets.token_bytes(16)
                digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
                db.execute(
                    "INSERT INTO users (username,password_salt,password_hash,role_id) VALUES (?,?,?,?)",
                    (username, salt, digest, role_id),
                )
                print(f"Cuenta inicial {role_id} creada para {username!r}.")
        db.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))


def token_digest(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def publish_inventory_event() -> None:
    event = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    with LIVE_LOCK:
        for client in tuple(LIVE_CLIENTS):
            try:
                client.put_nowait(event)
            except queue.Full:
                try:
                    client.get_nowait()
                    client.put_nowait(event)
                except (queue.Empty, queue.Full):
                    pass


class EmapaServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    server_version = "EMAPA-Inventory"
    sys_version = ""

    def handle(self) -> None:
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.log_date_time_string()} {self.address_string()} {fmt % args}")

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://unpkg.com; "
            "img-src 'self' data: https://tile.openstreetmap.org https://unpkg.com https://upload.wikimedia.org; "
            "connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        )
        request_origin = self.headers.get("Origin", "").rstrip("/")
        if request_origin and request_origin in configured_origins():
            self.send_header("Access-Control-Allow-Origin", request_origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Vary", "Origin")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        origin = self.headers.get("Origin", "").rstrip("/")
        if origin not in configured_origins():
            self.json(HTTPStatus.FORBIDDEN, {"error": "Origen no permitido."})
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            self.json(HTTPStatus.OK, {"status": "ok"})
            return
        if path == "/admin-inventarios":
            if self.get_session() is None:
                self.send_response(HTTPStatus.SEE_OTHER)
                self.send_header("Location", "/login")
                self.end_headers()
            else:
                self.serve_static("/")
            return
        if path == "/login":
            self.serve_static("/")
            return
        if path == "/api/auth/me":
            user = self.get_session()
            self.json(HTTPStatus.OK, {"user": user})
            return
        if path == "/api/catalog":
            with db_connection() as db:
                rows = db.execute("SELECT id,name,unit,category FROM products WHERE active=1 ORDER BY category,name").fetchall()
            self.json(HTTPStatus.OK, {"products": [dict(row) for row in rows]})
            return
        if path == "/api/branches":
            self.public_branches()
            return
        if path == "/api/live":
            self.live_stream()
            return
        if path == "/api/inventory/movements":
            user = self.get_session()
            if user is None:
                self.json(HTTPStatus.UNAUTHORIZED, {"error": "Autenticación requerida."})
                return
            with db_connection() as db:
                rows = db.execute(
                    """SELECT m.id,m.movement_type,m.quantity,m.previous_quantity,m.resulting_quantity,
                              m.occurred_at,l.lot_code,p.name AS product,b.name AS branch,u.username
                       FROM inventory_movements m JOIN inventory i ON i.id=m.inventory_id
                       JOIN lots l ON l.id=i.lot_id JOIN products p ON p.id=i.product_id
                       JOIN branches b ON b.id=i.branch_id JOIN users u ON u.id=m.user_id
                       ORDER BY m.id DESC LIMIT 200"""
                ).fetchall()
            self.json(HTTPStatus.OK, {"movements": [dict(row) for row in rows]})
            return
        if path in STATIC_FILES:
            self.serve_static(path)
            return
        self.json(HTTPStatus.NOT_FOUND, {"error": "Ruta no encontrada."})

    def do_POST(self) -> None:
        if not self.same_origin():
            self.json(HTTPStatus.FORBIDDEN, {"error": "Origen no permitido."})
            return
        payload = self.read_json()
        if payload is None:
            return
        path = urlparse(self.path).path
        if path == "/api/auth/login":
            self.login(payload)
        elif path == "/api/auth/logout":
            self.logout()
        elif path == "/api/inventory/movements":
            self.record_movement(payload)
        else:
            self.json(HTTPStatus.NOT_FOUND, {"error": "Ruta no encontrada."})

    def serve_static(self, route: str) -> None:
        filename, content_type = STATIC_FILES[route]
        try:
            body = (ROOT / filename).read_bytes()
        except OSError:
            self.json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Interfaz no disponible."})
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, object] | None:
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_BODY_BYTES:
                raise ValueError
            data = json.loads(self.rfile.read(size))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.json(HTTPStatus.BAD_REQUEST, {"error": "Cuerpo JSON vacío, inválido o demasiado grande."})
            return None
        if not isinstance(data, dict):
            self.json(HTTPStatus.BAD_REQUEST, {"error": "Se esperaba un objeto JSON."})
            return None
        return data

    def same_origin(self) -> bool:
        origin = self.headers.get("Origin", "").rstrip("/")
        scheme = "https" if os.environ.get("EMAPA_BEHIND_HTTPS") == "1" else "http"
        expected = f"{scheme}://{self.headers.get('Host', '')}"
        return bool(origin) and (hmac.compare_digest(origin, expected) or origin in configured_origins())

    def get_session(self) -> dict[str, object] | None:
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        cookie = cookies.get(SESSION_COOKIE)
        if cookie is None or not cookie.value:
            return None
        with db_connection() as db:
            row = db.execute(
                """SELECT u.id,u.username,u.role_id AS role,r.name AS role_name,s.expires_at
                   FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id
                   WHERE s.token_hash=? AND u.active=1""",
                (token_digest(cookie.value),),
            ).fetchone()
            if row is None:
                return None
            if row["expires_at"] <= int(time.time()):
                db.execute("DELETE FROM sessions WHERE token_hash=?", (token_digest(cookie.value),))
                return None
        return {"id": row["id"], "username": row["username"], "role": row["role"], "roleName": row["role_name"]}

    def login(self, payload: dict[str, object]) -> None:
        ip = self.client_address[0]
        now = time.time()
        with LOGIN_LOCK:
            attempts = [when for when in LOGIN_ATTEMPTS.get(ip, []) if now - when < 300]
            if len(attempts) >= 8:
                LOGIN_ATTEMPTS[ip] = attempts
                self.json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Demasiados intentos. Espera unos minutos."})
                return
            attempts.append(now)
            LOGIN_ATTEMPTS[ip] = attempts
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        with db_connection() as db:
            row = db.execute(
                """SELECT u.id,u.username,u.password_salt,u.password_hash,u.role_id,r.name AS role_name
                   FROM users u JOIN roles r ON r.id=u.role_id
                   WHERE u.username=? COLLATE NOCASE AND u.active=1""", (username,),
            ).fetchone()
        if row is None:
            hashlib.pbkdf2_hmac("sha256", password.encode(), b"emapa-invalid-user", PASSWORD_ITERATIONS)
            self.json(HTTPStatus.UNAUTHORIZED, {"error": "Usuario o contraseña incorrectos."})
            return
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), row["password_salt"], PASSWORD_ITERATIONS)
        if not hmac.compare_digest(candidate, row["password_hash"]):
            self.json(HTTPStatus.UNAUTHORIZED, {"error": "Usuario o contraseña incorrectos."})
            return
        token = secrets.token_urlsafe(32)
        expires = int(time.time()) + SESSION_SECONDS
        with db_connection() as db:
            db.execute("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", (token_digest(token), row["id"], expires))
        user = {"id": row["id"], "username": row["username"], "role": row["role_id"], "roleName": row["role_name"]}
        secure = "; Secure" if os.environ.get("EMAPA_COOKIE_SECURE") == "1" else ""
        body = json.dumps({"user": user}, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        same_site = "None" if os.environ.get("EMAPA_CROSS_SITE_COOKIES") == "1" else "Strict"
        self.send_header("Set-Cookie", f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite={same_site}; Max-Age={SESSION_SECONDS}{secure}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        with LOGIN_LOCK:
            LOGIN_ATTEMPTS.pop(ip, None)

    def logout(self) -> None:
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            pass
        cookie = cookies.get(SESSION_COOKIE)
        if cookie:
            with db_connection() as db:
                db.execute("DELETE FROM sessions WHERE token_hash=?", (token_digest(cookie.value),))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        same_site = "None" if os.environ.get("EMAPA_CROSS_SITE_COOKIES") == "1" else "Strict"
        secure = "; Secure" if os.environ.get("EMAPA_COOKIE_SECURE") == "1" else ""
        self.send_header("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite={same_site}; Max-Age=0{secure}")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")

    def public_branches(self) -> None:
        with db_connection() as db:
            branches = db.execute("SELECT id,name,city,address,latitude,longitude FROM branches WHERE active=1 ORDER BY id").fetchall()
            products = db.execute("SELECT id FROM products WHERE active=1").fetchall()
            stocks = db.execute("SELECT branch_id,product_id,SUM(quantity) AS quantity FROM inventory GROUP BY branch_id,product_id").fetchall()
        stock_index = {(row["branch_id"], row["product_id"]): row["quantity"] for row in stocks}
        product_ids = [row["id"] for row in products]
        result = [{
            "id": branch["id"], "name": branch["name"], "city": branch["city"],
            "address": branch["address"], "lat": branch["latitude"], "lng": branch["longitude"],
            "stocks": {product_id: stock_index.get((branch["id"], product_id)) for product_id in product_ids},
        } for branch in branches]
        updated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.json(HTTPStatus.OK, {"branches": result, "updatedAt": updated})

    def record_movement(self, payload: dict[str, object]) -> None:
        user = self.get_session()
        if user is None:
            self.json(HTTPStatus.UNAUTHORIZED, {"error": "Inicia sesión para registrar movimientos."})
            return
        if user["role"] not in {"warehouse", "supervisor"}:
            self.json(HTTPStatus.FORBIDDEN, {"error": "Tu rol solo permite consultar el kardex."})
            return
        branch_id = str(payload.get("branchId", ""))
        product_id = str(payload.get("productId", ""))
        lot_code = str(payload.get("lotCode", "")).strip()
        movement_type = str(payload.get("movementType", ""))
        try:
            quantity = float(payload.get("quantity", 0))
        except (TypeError, ValueError):
            quantity = 0
        if not branch_id or not product_id or not lot_code or len(lot_code) > 64 or movement_type not in {"entry", "exit"} or not 0 < quantity <= 1_000_000_000:
            self.json(HTTPStatus.BAD_REQUEST, {"error": "Datos de movimiento inválidos."})
            return
        request_id = str(uuid.uuid4())
        try:
            with db_connection() as db:
                db.execute("BEGIN IMMEDIATE")
                if not db.execute("SELECT 1 FROM branches WHERE id=? AND active=1", (branch_id,)).fetchone():
                    db.rollback()
                    self.json(HTTPStatus.BAD_REQUEST, {"error": "Sucursal no válida."})
                    return
                if not db.execute("SELECT 1 FROM products WHERE id=? AND active=1", (product_id,)).fetchone():
                    db.rollback()
                    self.json(HTTPStatus.BAD_REQUEST, {"error": "Producto no válido."})
                    return
                db.execute("INSERT OR IGNORE INTO lots(product_id,lot_code) VALUES(?,?)", (product_id, lot_code))
                lot_id = db.execute("SELECT id FROM lots WHERE product_id=? AND lot_code=?", (product_id, lot_code)).fetchone()["id"]
                db.execute("INSERT OR IGNORE INTO inventory(branch_id,product_id,lot_id,quantity) VALUES(?,?,?,0)", (branch_id, product_id, lot_id))
                stock = db.execute("SELECT id,quantity FROM inventory WHERE branch_id=? AND product_id=? AND lot_id=?", (branch_id, product_id, lot_id)).fetchone()
                previous = float(stock["quantity"])
                if movement_type == "exit" and quantity > previous:
                    db.rollback()
                    self.json(HTTPStatus.CONFLICT, {"error": f"Stock insuficiente en ese lote. Disponible: {previous:g}."})
                    return
                resulting = previous + quantity if movement_type == "entry" else previous - quantity
                db.execute("UPDATE inventory SET quantity=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", (resulting, stock["id"]))
                db.execute(
                    """INSERT INTO inventory_movements
                       (inventory_id,user_id,movement_type,quantity,previous_quantity,resulting_quantity,request_id)
                       VALUES(?,?,?,?,?,?,?)""",
                    (stock["id"], user["id"], movement_type, quantity, previous, resulting, request_id),
                )
                db.commit()
        except sqlite3.Error:
            self.json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "No se pudo guardar el movimiento."})
            return
        publish_inventory_event()
        self.json(HTTPStatus.CREATED, {"movementId": request_id, "quantity": resulting, "message": "Movimiento registrado."})

    def live_stream(self) -> None:
        client: queue.Queue[dict[str, str]] = queue.Queue(maxsize=1)
        with LIVE_LOCK:
            LIVE_CLIENTS.add(client)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    event = client.get(timeout=20)
                    payload = json.dumps(event, separators=(",", ":"))
                    self.wfile.write(f"event: inventory-updated\ndata: {payload}\n\n".encode("utf-8"))
                except queue.Empty:
                    self.wfile.write(b": keep-alive\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError):
            pass
        finally:
            with LIVE_LOCK:
                LIVE_CLIENTS.discard(client)


if __name__ == "__main__":
    load_dotenv()
    DB_PATH = Path(os.environ.get("EMAPA_DB_PATH", ROOT / "database" / "emapa.sqlite3"))
    initialize_db()
    host = os.environ.get("EMAPA_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("EMAPA_PORT", "8000")))
    if not os.environ.get("EMAPA_ADMIN_USERNAME") or not os.environ.get("EMAPA_ADMIN_PASSWORD"):
        print("AVISO: configura EMAPA_ADMIN_USERNAME y EMAPA_ADMIN_PASSWORD para habilitar acceso inicial.")
    print(f"EMAPA: http://{host}:{port} (usar HTTPS y proxy seguro en producción).")
    try:
        EmapaServer((host, port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
