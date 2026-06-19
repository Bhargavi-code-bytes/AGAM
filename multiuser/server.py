#!/usr/bin/env python3
import json
import os
import sqlite3
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB_ROOT = os.path.join(ROOT, "web")
DB_PATH = os.path.join(ROOT, "agam_multiuser.db")
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8080"))
SESSION_HOURS = 24

ROLE_SCOPES = {
    "super_admin": ["students", "patients", "therapeutic", "payments", "attendance", "schedule", "reports", "audit", "settings"],
    "student_admin": ["students", "therapeutic", "attendance", "schedule", "reports"],
    "patient_admin": ["patients", "therapeutic", "schedule", "reports"],
    "finance_admin": ["payments", "reports"],
}


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str, salt: bytes | None = None) -> str:
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except Exception:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return hmac.compare_digest(check, expected)


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            must_change_password INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    user_count = cur.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    if user_count == 0:
        seed_users = [
            ("admin", "Admin123!", "super_admin", "System Owner"),
            ("students", "Student123!", "student_admin", "Student Desk"),
            ("patients", "Patient123!", "patient_admin", "Patient Desk"),
            ("finance", "Finance123!", "finance_admin", "Finance Desk"),
        ]
        for username, pwd, role, name in seed_users:
            cur.execute(
                "INSERT INTO users (username, password_hash, role, name, must_change_password) VALUES (?, ?, ?, ?, 1)",
                (username, hash_password(pwd), role, name),
            )

    state = cur.execute("SELECT id FROM app_state WHERE id=1").fetchone()
    if not state:
        demo = {
            "students": [
                {
                    "id": "s-1001",
                    "fullName": "Amina Yusuf",
                    "studentId": "S-1001",
                    "phone": "+1 555 000 1000",
                    "martialArtsStyle": "Karate",
                    "beltRank": "Blue",
                    "takingTreatment": True,
                    "treatmentPlan": "Shoulder mobility therapy with modified class drills",
                    "therapyNotes": "Improving ROM week by week",
                    "active": True,
                },
                {
                    "id": "s-1002",
                    "fullName": "Daniel Okoro",
                    "studentId": "S-1002",
                    "phone": "+1 555 000 1001",
                    "martialArtsStyle": "Taekwondo",
                    "beltRank": "Green",
                    "takingTreatment": False,
                    "treatmentPlan": "",
                    "therapyNotes": "",
                    "active": True,
                },
            ],
            "patients": [
                {
                    "id": "p-2001",
                    "fullName": "Grace Mensah",
                    "patientId": "P-2001",
                    "contact": "+1 555 000 2000",
                    "treatmentPlan": "Back pain rehab protocol",
                    "progressNotes": "Pain reduced from 7/10 to 3/10",
                    "active": True,
                }
            ],
            "classSchedule": [],
            "attendance": [],
            "treatmentSchedule": [],
            "sessionPlans": [],
            "payments": [],
            "auditLog": [],
            "updatedAt": utc_now_iso(),
        }
        cur.execute(
            "INSERT INTO app_state (id, data_json, updated_at) VALUES (1, ?, ?)",
            (json.dumps(demo), utc_now_iso()),
        )

    conn.commit()
    conn.close()


def get_state(conn):
    row = conn.execute("SELECT data_json FROM app_state WHERE id=1").fetchone()
    return json.loads(row["data_json"]) if row else {"students": [], "patients": [], "auditLog": []}


def save_state(conn, state):
    state["updatedAt"] = utc_now_iso()
    conn.execute(
        "UPDATE app_state SET data_json=?, updated_at=? WHERE id=1",
        (json.dumps(state), utc_now_iso()),
    )


def create_session(conn, user_id):
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)).isoformat()
    conn.execute(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (token, user_id, expires, utc_now_iso()),
    )
    return token


def get_user_from_token(conn, token):
    row = conn.execute(
        """
        SELECT u.id, u.username, u.role, u.name, u.must_change_password, s.expires_at
        FROM sessions s JOIN users u ON s.user_id=u.id
        WHERE s.token=?
        """,
        (token,),
    ).fetchone()
    if not row:
        return None
    if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
        "name": row["name"],
        "mustChangePassword": bool(row["must_change_password"]),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "AGAMMultiUser/1.0"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def json_response(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def parse_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                return {}
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def auth_user(self, conn):
        auth = self.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "", 1).strip() if auth.startswith("Bearer ") else None
        if not token:
            return None
        return get_user_from_token(conn, token)

    def serve_static(self, path):
        rel = path.lstrip("/") or "index.html"
        fs = os.path.normpath(os.path.join(WEB_ROOT, rel))
        if not fs.startswith(WEB_ROOT):
            self.send_error(403)
            return
        if os.path.isdir(fs):
            fs = os.path.join(fs, "index.html")
        if not os.path.exists(fs):
            self.send_error(404)
            return
        ctype = "text/plain"
        if fs.endswith(".html"):
            ctype = "text/html; charset=utf-8"
        elif fs.endswith(".css"):
            ctype = "text/css; charset=utf-8"
        elif fs.endswith(".js"):
            ctype = "application/javascript; charset=utf-8"
        with open(fs, "rb") as f:
            data = f.read()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return self.serve_static(path)

        conn = db_conn()
        try:
            if path == "/api/session":
                user = self.auth_user(conn)
                if not user:
                    return self.json_response(401, {"error": "Not authenticated"})
                return self.json_response(200, {"user": user, "scopes": ROLE_SCOPES.get(user["role"], [])})

            if path == "/api/data":
                user = self.auth_user(conn)
                if not user:
                    return self.json_response(401, {"error": "Not authenticated"})
                state = get_state(conn)
                return self.json_response(200, {"data": state})

            return self.json_response(404, {"error": "Not found"})
        finally:
            conn.close()

    def do_POST(self):
        path = urlparse(self.path).path
        data = self.parse_json()
        if data is None:
            return self.json_response(400, {"error": "Invalid JSON"})

        conn = db_conn()
        try:
            if path == "/api/login":
                username = str(data.get("username", "")).strip()
                password = str(data.get("password", ""))
                row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
                if not row or not verify_password(password, row["password_hash"]):
                    return self.json_response(401, {"error": "Invalid credentials"})
                token = create_session(conn, row["id"])
                conn.commit()
                user = {
                    "id": row["id"],
                    "username": row["username"],
                    "role": row["role"],
                    "name": row["name"],
                    "mustChangePassword": bool(row["must_change_password"]),
                }
                return self.json_response(200, {"token": token, "user": user, "scopes": ROLE_SCOPES.get(row["role"], [])})

            if path == "/api/logout":
                auth = self.headers.get("Authorization", "")
                token = auth.replace("Bearer ", "", 1).strip() if auth.startswith("Bearer ") else ""
                if token:
                    conn.execute("DELETE FROM sessions WHERE token=?", (token,))
                    conn.commit()
                return self.json_response(200, {"ok": True})

            if path == "/api/change-password":
                user = self.auth_user(conn)
                if not user:
                    return self.json_response(401, {"error": "Not authenticated"})
                current_password = str(data.get("currentPassword", ""))
                new_password = str(data.get("newPassword", ""))
                if len(new_password) < 8:
                    return self.json_response(400, {"error": "Password too short"})
                row = conn.execute("SELECT password_hash FROM users WHERE id=?", (user["id"],)).fetchone()
                if not verify_password(current_password, row["password_hash"]):
                    return self.json_response(400, {"error": "Current password invalid"})
                conn.execute(
                    "UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?",
                    (hash_password(new_password), user["id"]),
                )
                conn.commit()
                return self.json_response(200, {"ok": True})

            return self.json_response(404, {"error": "Not found"})
        finally:
            conn.close()

    def do_PUT(self):
        path = urlparse(self.path).path
        data = self.parse_json()
        if data is None:
            return self.json_response(400, {"error": "Invalid JSON"})

        conn = db_conn()
        try:
            if path == "/api/data":
                user = self.auth_user(conn)
                if not user:
                    return self.json_response(401, {"error": "Not authenticated"})
                incoming = data.get("data")
                if not isinstance(incoming, dict):
                    return self.json_response(400, {"error": "Invalid data payload"})
                state = get_state(conn)
                # Keep only known top-level collections to prevent accidental schema drift.
                for key in ["students", "patients", "classSchedule", "attendance", "treatmentSchedule", "sessionPlans", "payments", "auditLog"]:
                    if key in incoming and isinstance(incoming[key], list):
                        state[key] = incoming[key]
                save_state(conn, state)
                conn.commit()
                return self.json_response(200, {"ok": True, "updatedAt": state["updatedAt"]})

            return self.json_response(404, {"error": "Not found"})
        finally:
            conn.close()


def main():
    init_db()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"AGAM multi-user server running at http://{HOST}:{PORT}")
    print(f"Open http://localhost:{PORT} in browser")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
