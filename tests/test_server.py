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

    def test_entry_exit_traceability_and_role_enforcement(self):
        supervisor = self.login()
        entry = {"branchId": "cbba-01", "productId": "arroz-grano", "movementType": "entry", "quantity": 35, "lotCode": "TEST-LOT-01"}
        saved = self.request(supervisor, "/api/inventory/movements", entry)
        self.assertEqual(saved.status, 201)
        stock = json.load(self.request(supervisor, "/api/branches"))["branches"][0]["stocks"]["arroz-grano"]
        self.assertEqual(stock, 35)
        exit_payload = {**entry, "movementType": "exit", "quantity": 5}
        self.assertEqual(self.request(supervisor, "/api/inventory/movements", exit_payload).status, 201)
        too_much = {**entry, "movementType": "exit", "quantity": 100}
        with self.assertRaises(urllib.error.HTTPError) as response:
            self.request(supervisor, "/api/inventory/movements", too_much)
        self.assertEqual(response.exception.code, 409)
        ledger = json.load(self.request(supervisor, "/api/inventory/movements"))["movements"]
        self.assertEqual(len(ledger), 2)
        self.assertEqual(ledger[0]["username"], "test-supervisor")
        warehouse = self.login("test-warehouse", "test-warehouse-password-2026")
        warehouse_entry = {**entry, "branchId": "cbba-02", "lotCode": "WAREHOUSE-LOT-02"}
        self.assertEqual(self.request(warehouse, "/api/inventory/movements", warehouse_entry).status, 201)
        auditor = self.login("test-auditor", "test-auditor-password-2026")
        self.assertEqual(self.request(auditor, "/api/inventory/movements").status, 200)
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
