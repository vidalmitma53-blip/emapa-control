import json
import os
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMP_DIR = tempfile.TemporaryDirectory()
os.environ["EMAPA_DB_PATH"] = str(Path(TEMP_DIR.name) / "test.sqlite3")
os.environ["EMAPA_ADMIN_USERNAME"] = "test-supervisor"
os.environ["EMAPA_ADMIN_PASSWORD"] = "test-supervisor-password-2026"
os.environ["EMAPA_WAREHOUSE_USERNAME"] = "test-warehouse"
os.environ["EMAPA_WAREHOUSE_PASSWORD"] = "test-warehouse-password-2026"
os.environ["EMAPA_AUDITOR_USERNAME"] = "test-auditor"
os.environ["EMAPA_AUDITOR_PASSWORD"] = "test-auditor-password-2026"

import sys
sys.path.insert(0, str(ROOT))
import server


class InventoryApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.initialize_db()
        cls.httpd = server.EmapaServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.origin = f"http://127.0.0.1:{cls.port}"
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        TEMP_DIR.cleanup()

    def opener(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

    def setUp(self):
        server.DB_PATH = Path(TEMP_DIR.name) / f"{self._testMethodName}.sqlite3"
        server.initialize_db()

    def request(self, opener, path, payload=None, origin=True):
        data = json.dumps(payload).encode() if payload is not None else None
        headers = {"Content-Type": "application/json"}
        if origin:
            headers["Origin"] = self.origin
        request = urllib.request.Request(self.origin + path, data=data, headers=headers)
        return opener.open(request, timeout=5)

    def login(self, username="test-supervisor", password="test-supervisor-password-2026"):
        opener = self.opener()
        response = self.request(opener, "/api/auth/login", {"username": username, "password": password})
        self.assertEqual(response.status, 200)
        return opener

    def test_catalog_and_twenty_public_branches_have_no_fabricated_stock(self):
        opener = self.opener()
        catalog = json.load(self.request(opener, "/api/catalog"))["products"]
        branches = json.load(self.request(opener, "/api/branches"))["branches"]
        self.assertEqual(len(catalog), 12)
        self.assertEqual(len(branches), 20)
        self.assertTrue(all(len(branch["stocks"]) == 12 for branch in branches))
        self.assertTrue(all(value is None for branch in branches for value in branch["stocks"].values()))

    def test_admin_route_requires_login_and_session_is_created(self):
        request = urllib.request.Request(self.origin + "/admin-inventarios")
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        with self.assertRaises(urllib.error.HTTPError) as response:
            opener.open(request, timeout=5)
        self.assertEqual(response.exception.code, 303)
        self.assertEqual(response.exception.headers["Location"], "/login")
        logged_in = self.login()
        session = json.load(self.request(logged_in, "/api/auth/me"))["user"]
        self.assertEqual(session["role"], "supervisor")

    def test_render_health_check(self):
        response = urllib.request.urlopen(self.origin + "/health", timeout=5)
        self.assertEqual(response.status, 200)
        self.assertEqual(json.load(response), {"status": "ok"})

    def test_buyer_is_limited_to_five_distinct_products_per_day(self):
        supervisor = self.login()
        buyer = {"buyerName": "Comprador Prueba", "buyerDocument": "98765432"}
        products = [
            "arroz-grano", "arroz-seleccionado", "harina-trigo-especial",
            "harina-trigo-000", "maiz-amarillo-duro", "aceite-comestible"
        ]
        for index, product_id in enumerate(products):
            movement = {
                "branchId": "cbba-03",
                "productId": product_id,
                "movementType": "entry",
                "quantity": 2,
                "lotCode": f"LIMIT-TEST-{index}",
            }
            self.assertEqual(self.request(supervisor, "/api/inventory/movements", movement).status, 201)
            exit_movement = {
                **movement,
                **buyer,
                "movementType": "exit",
                "quantity": 1,
            }
            if index < 5:
                self.assertEqual(self.request(supervisor, "/api/inventory/movements", exit_movement).status, 201)
            else:
                with self.assertRaises(urllib.error.HTTPError) as response:
                    self.request(supervisor, "/api/inventory/movements", exit_movement)
                self.assertEqual(response.exception.code, 409)

    def test_existing_movement_table_is_migrated_for_buyer_data(self):
        legacy_path = Path(TEMP_DIR.name) / "legacy.sqlite3"
        server.DB_PATH = legacy_path
        legacy_db = sqlite3.connect(legacy_path)
        try:
            legacy_db.execute(
                """CREATE TABLE inventory_movements (
                    id INTEGER PRIMARY KEY,
                    inventory_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    movement_type TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    previous_quantity REAL NOT NULL,
                    resulting_quantity REAL NOT NULL,
                    occurred_at TEXT NOT NULL,
                    request_id TEXT NOT NULL UNIQUE
                )"""
            )
        finally:
            legacy_db.close()
        server.initialize_db()
        with server.db_connection() as db:
            columns = {row["name"] for row in db.execute("PRAGMA table_info(inventory_movements)")}
            indexes = {row["name"] for row in db.execute("PRAGMA index_list(inventory_movements)")}
        self.assertIn("buyer_name", columns)
        self.assertIn("buyer_document", columns)
        self.assertIn("idx_movements_buyer_product_day", indexes)

    def test_entry_exit_traceability_and_role_enforcement(self):
        supervisor = self.login()
        entry = {"branchId": "cbba-01", "productId": "arroz-grano", "movementType": "entry", "quantity": 35, "lotCode": "TEST-LOT-01"}
        saved = self.request(supervisor, "/api/inventory/movements", entry)
        self.assertEqual(saved.status, 201)
        stock = json.load(self.request(supervisor, "/api/branches"))["branches"][0]["stocks"]["arroz-grano"]
        self.assertEqual(stock, 35)
        exit_payload = {
            **entry,
            "movementType": "exit",
            "quantity": 5,
            "buyerName": "Comprador de Prueba",
            "buyerDocument": "12345678CB",
        }
        self.assertEqual(self.request(supervisor, "/api/inventory/movements", exit_payload).status, 201)
        too_much = {**exit_payload, "quantity": 100}
        with self.assertRaises(urllib.error.HTTPError) as response:
            self.request(supervisor, "/api/inventory/movements", too_much)
        self.assertEqual(response.exception.code, 409)
        over_daily_limit = {**exit_payload, "quantity": 6}
        with self.assertRaises(urllib.error.HTTPError) as response:
            self.request(supervisor, "/api/inventory/movements", over_daily_limit)
        self.assertEqual(response.exception.code, 409)
        ledger = json.load(self.request(supervisor, "/api/inventory/movements"))["movements"]
        self.assertEqual(len(ledger), 2)
        self.assertEqual(ledger[0]["username"], "test-supervisor")
        self.assertEqual(ledger[0]["buyer_name"], "Comprador de Prueba")
        self.assertEqual(ledger[0]["buyer_document"], "12345678CB")
        public_snapshot = json.load(self.request(self.opener(), "/api/branches"))
        self.assertNotIn("Comprador de Prueba", json.dumps(public_snapshot, ensure_ascii=False))
        self.assertNotIn("12345678CB", json.dumps(public_snapshot, ensure_ascii=False))
        missing_buyer = {**exit_payload, "buyerDocument": ""}
        with self.assertRaises(urllib.error.HTTPError) as response:
            self.request(supervisor, "/api/inventory/movements", missing_buyer)
        self.assertEqual(response.exception.code, 400)
        warehouse = self.login("test-warehouse", "test-warehouse-password-2026")
        warehouse_entry = {**entry, "branchId": "cbba-02", "lotCode": "WAREHOUSE-LOT-02"}
        self.assertEqual(self.request(warehouse, "/api/inventory/movements", warehouse_entry).status, 201)
        warehouse_exit = {
            **warehouse_entry,
            "movementType": "exit",
            "quantity": 1,
            "buyerName": "Comprador Interno",
            "buyerDocument": "87654321",
        }
        self.assertEqual(self.request(warehouse, "/api/inventory/movements", warehouse_exit).status, 201)
        warehouse_ledger = json.load(self.request(warehouse, "/api/inventory/movements"))["movements"]
        warehouse_sale = next(item for item in warehouse_ledger if item["movement_type"] == "exit")
        self.assertEqual(warehouse_sale["buyer_document"], "87****21")
        auditor = self.login("test-auditor", "test-auditor-password-2026")
        auditor_ledger = json.load(self.request(auditor, "/api/inventory/movements"))["movements"]
        auditor_sale = next(item for item in auditor_ledger if item["movement_type"] == "exit")
        self.assertEqual(auditor_sale["buyer_document"], "87654321")
        with self.assertRaises(urllib.error.HTTPError) as response:
            self.request(auditor, "/api/inventory/movements", entry)
        self.assertEqual(response.exception.code, 403)

    def test_mutation_rejects_missing_origin(self):
        with self.assertRaises(urllib.error.HTTPError) as response:
            self.request(self.opener(), "/api/auth/login", {"username": "x", "password": "y"}, origin=False)
        self.assertEqual(response.exception.code, 403)

    def test_cors_preflight_allows_configured_netlify_origin_only(self):
        previous = os.environ.get("EMAPA_CORS_ORIGINS")
        os.environ["EMAPA_CORS_ORIGINS"] = "https://emapa-example.netlify.app"
        try:
            request = urllib.request.Request(
                self.origin + "/api/auth/login",
                method="OPTIONS",
                headers={
                    "Origin": "https://emapa-example.netlify.app",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
            response = urllib.request.urlopen(request, timeout=5)
            self.assertEqual(response.status, 204)
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], "https://emapa-example.netlify.app")
            self.assertEqual(response.headers["Access-Control-Allow-Credentials"], "true")
            denied = urllib.request.Request(
                self.origin + "/api/auth/login",
                method="OPTIONS",
                headers={"Origin": "https://unknown.example"},
            )
            with self.assertRaises(urllib.error.HTTPError) as response:
                urllib.request.urlopen(denied, timeout=5)
            self.assertEqual(response.exception.code, 403)
        finally:
            if previous is None:
                os.environ.pop("EMAPA_CORS_ORIGINS", None)
            else:
                os.environ["EMAPA_CORS_ORIGINS"] = previous


if __name__ == "__main__":
    unittest.main()
