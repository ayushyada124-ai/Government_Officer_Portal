"""Government Officer Portal - Flask + MySQL (single folder).
Run:  python app.py   then open http://localhost:5000
"""
import os, functools, threading, time
import mysql.connector
from flask import Flask, request, jsonify, g, abort, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature

HERE = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)
app.json.default = lambda o: o.isoformat() if hasattr(o, "isoformat") else str(o)
CORS(app)
ser = URLSafeTimedSerializer(os.getenv("SECRET_KEY", "change-this-secret"))
CFG = dict(host=os.getenv("DB_HOST", "localhost"), user=os.getenv("DB_USER", "root"),
           password=os.getenv("DB_PASSWORD", ""), database=os.getenv("DB_NAME", "gov_portal"),
           port=int(os.getenv("DB_PORT", "3306")), connection_timeout=10)
if os.getenv("DB_SSL_CA"):
    CFG["ssl_ca"] = os.getenv("DB_SSL_CA")


_local = threading.local()


def get_con():
    """Keep one connection open and reuse it (opening a secure connection for every query is slow)."""
    con = getattr(_local, "con", None)
    if con is None:
        con = mysql.connector.connect(autocommit=True, **CFG)
        _local.con = con
    return con


def q(sql, args=(), one=False, commit=False):
    for attempt in (1, 2):
        try:
            cur = get_con().cursor(dictionary=True)
            try:
                cur.execute(sql, args)
                return cur.lastrowid if commit else (cur.fetchone() if one else cur.fetchall())
            finally:
                cur.close()
        except (mysql.connector.OperationalError, mysql.connector.InterfaceError, OSError):
            _local.con = None  # connection went stale: reconnect once and retry
            if attempt == 2:
                raise


def cnt(sql, a=()):
    return q(sql, a, one=True)["c"]


def init_db():
    try:
        con = mysql.connector.connect(**CFG)
    except mysql.connector.Error:
        # database may not exist yet (local MySQL): create it, then connect again
        root = mysql.connector.connect(**{k: v for k, v in CFG.items() if k != "database"})
        root.cursor().execute(f"CREATE DATABASE IF NOT EXISTS `{CFG['database']}`")
        root.close()
        con = mysql.connector.connect(**CFG)
    cur = con.cursor()
    names = ("users", "tasks", "leaves", "announcements", "attendance")
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=%s AND table_name IN (%s,%s,%s,%s,%s)",
                (CFG["database"],) + names)
    if cur.fetchone()[0] < len(names):
        for stmt in open(os.path.join(HERE, "schema.sql")).read().split(";"):
            if stmt.strip():
                cur.execute(stmt)
        con.commit()
    cur.close(); con.close()
    if not q("SELECT id FROM users LIMIT 1", one=True):
        seed = [("System Admin", "admin@gov.in", "Admin@123", "admin", "Administration", "Administrator"),
                ("Rahul Sharma", "officer@gov.in", "Officer@123", "officer", "Revenue", "District Officer")]
        for n, e, p, r, d, ds in seed:
            q("INSERT INTO users(name,email,password_hash,role,department,designation) VALUES(%s,%s,%s,%s,%s,%s)",
              (n, e, generate_password_hash(p), r, d, ds), commit=True)


_ready = False


@app.before_request
def ensure_db():
    """On hosted servers app.py is imported (not run), so create the tables on the first API call."""
    global _ready
    if not _ready and request.path.startswith("/api/"):
        init_db()
        _ready = True


def auth(role=None):
    """Check the signed login token. The token carries the user id and role, so no database
    query is needed here (one less round trip to MySQL on every request)."""
    def deco(f):
        @functools.wraps(f)
        def wrap(*a, **k):
            token = request.headers.get("Authorization", "").replace("Bearer ", "")
            try:
                data = ser.loads(token, max_age=86400)
            except BadSignature:
                return jsonify(error="Please sign in again"), 401
            if isinstance(data, dict):
                u = {"id": data["id"], "role": data["role"]}
            else:  # older tokens (id only): look the user up once
                u = q("SELECT id,role FROM users WHERE id=%s", (data,), one=True)
                if not u:
                    return jsonify(error="Please sign in again"), 401
            if role and u["role"] != role:
                return jsonify(error="You do not have access to this action"), 403
            g.user = u
            return f(*a, **k)
        return wrap
    return deco


# Website files live in public/ (Vercel serves that folder itself; locally Flask serves it).
PUBLIC = os.path.join(HERE, "public")
PAGES = {"index.html", "style.css", "script.js"}


@app.get("/")
@app.get("/<name>")
def page(name="index.html"):
    if name not in PAGES:
        abort(404)
    return send_from_directory(PUBLIC, name)


@app.get("/api/health")
def health():
    """Speed check: open /api/health to see how far the database is from the server (no data is shown)."""
    _local.con = None
    t0 = time.time(); get_con()
    t1 = time.time(); q("SELECT 1 AS x", one=True)
    t2 = time.time(); q("SELECT 1 AS x", one=True)
    t3 = time.time()
    return jsonify(connect_ms=round((t1 - t0) * 1000), first_query_ms=round((t2 - t1) * 1000),
                   second_query_ms=round((t3 - t2) * 1000))


@app.post("/api/login")
def login():
    d = request.json or {}
    u = q("SELECT * FROM users WHERE email=%s AND role=%s", (d.get("email", "").strip().lower(), d.get("role")), one=True)
    if not u or not check_password_hash(u["password_hash"], d.get("password", "")):
        return jsonify(error="Invalid credentials"), 401
    u.pop("password_hash")
    return jsonify(token=ser.dumps({"id": u["id"], "role": u["role"]}), user=u)


@app.get("/api/me")
@auth()
def me():
    u = q("SELECT id,name,email,role,department,designation,phone FROM users WHERE id=%s", (g.user["id"],), one=True)
    if not u:
        return jsonify(error="Please sign in again"), 401
    return jsonify(u)


@app.put("/api/me")
@auth()
def update_me():
    d = request.json or {}
    q("UPDATE users SET phone=%s WHERE id=%s", (d.get("phone", ""), g.user["id"]), commit=True)
    if d.get("password"):
        if len(d["password"]) < 6:
            return jsonify(error="Password must be at least 6 characters"), 400
        q("UPDATE users SET password_hash=%s WHERE id=%s", (generate_password_hash(d["password"]), g.user["id"]), commit=True)
    return jsonify(q("SELECT id,name,email,role,department,designation,phone FROM users WHERE id=%s", (g.user["id"],), one=True))


@app.get("/api/stats")
@auth()
def stats():
    adm = g.user["role"] == "admin"
    w, a = ("", ()) if adm else (" WHERE officer_id=%s", (g.user["id"],))
    t = q("SELECT COUNT(*) total, SUM(status='Pending') pending, SUM(status='In Progress') progress, "
          "SUM(status='Completed') completed FROM tasks" + w, a, one=True)
    l = q("SELECT COUNT(*) total, SUM(status='Pending') pending FROM leaves" + w, a, one=True)
    r = dict(tasks=int(t["total"]), pending=int(t["pending"] or 0), progress=int(t["progress"] or 0),
             completed=int(t["completed"] or 0), pending_leaves=int(l["pending"] or 0))
    if adm:
        r["officers"] = cnt("SELECT COUNT(*) c FROM users WHERE role='officer'")
    else:
        r["leaves"] = int(l["total"])
    return jsonify(r)


# ---------- Officers (admin) ----------
@app.get("/api/officers")
@auth("admin")
def officers():
    return jsonify(q("SELECT id,name,email,department,designation,phone FROM users WHERE role='officer' ORDER BY id DESC"))


@app.post("/api/officers")
@auth("admin")
def add_officer():
    d = request.json or {}
    if not all(d.get(k) for k in ("name", "email", "password")) or len(d["password"]) < 6:
        return jsonify(error="Name, email and a password (6+ characters) are required"), 400
    email = d["email"].strip().lower()
    if q("SELECT id FROM users WHERE email=%s", (email,), one=True):
        return jsonify(error="Email already exists"), 409
    i = q("INSERT INTO users(name,email,password_hash,role,department,designation,phone) VALUES(%s,%s,%s,'officer',%s,%s,%s)",
          (d["name"], email, generate_password_hash(d["password"]), d.get("department", ""), d.get("designation", ""), d.get("phone", "")), commit=True)
    return jsonify(id=i), 201


@app.delete("/api/officers/<int:i>")
@auth("admin")
def del_officer(i):
    q("DELETE FROM users WHERE id=%s AND role='officer'", (i,), commit=True)
    return jsonify(ok=True)


# ---------- Tasks ----------
@app.get("/api/tasks")
@auth()
def tasks():
    s = "SELECT t.*,u.name officer_name FROM tasks t JOIN users u ON u.id=t.officer_id"
    if g.user["role"] == "admin":
        return jsonify(q(s + " ORDER BY t.id DESC"))
    return jsonify(q(s + " WHERE t.officer_id=%s ORDER BY t.id DESC", (g.user["id"],)))


@app.post("/api/tasks")
@auth("admin")
def add_task():
    d = request.json or {}
    if not d.get("title") or not d.get("officer_id"):
        return jsonify(error="Title and officer are required"), 400
    i = q("INSERT INTO tasks(title,description,officer_id,priority,due_date) VALUES(%s,%s,%s,%s,%s)",
          (d["title"], d.get("description", ""), d["officer_id"], d.get("priority", "Medium"), d.get("due_date") or None), commit=True)
    return jsonify(id=i), 201


@app.put("/api/tasks/<int:i>")
@auth()
def update_task(i):
    st = (request.json or {}).get("status")
    if st not in ("Pending", "In Progress", "Completed"):
        return jsonify(error="Invalid status"), 400
    sql, a = "UPDATE tasks SET status=%s WHERE id=%s", (st, i)
    if g.user["role"] != "admin":
        sql += " AND officer_id=%s"; a += (g.user["id"],)
    q(sql, a, commit=True)
    return jsonify(ok=True)


@app.delete("/api/tasks/<int:i>")
@auth("admin")
def del_task(i):
    q("DELETE FROM tasks WHERE id=%s", (i,), commit=True)
    return jsonify(ok=True)


# ---------- Leave ----------
@app.get("/api/leaves")
@auth()
def leaves():
    s = "SELECT l.*,u.name officer_name FROM leaves l JOIN users u ON u.id=l.officer_id"
    if g.user["role"] == "admin":
        return jsonify(q(s + " ORDER BY l.id DESC"))
    return jsonify(q(s + " WHERE l.officer_id=%s ORDER BY l.id DESC", (g.user["id"],)))


@app.post("/api/leaves")
@auth("officer")
def add_leave():
    d = request.json or {}
    if not (d.get("from_date") and d.get("to_date") and d.get("reason")) or d["to_date"] < d["from_date"]:
        return jsonify(error="Enter valid dates and a reason"), 400
    i = q("INSERT INTO leaves(officer_id,from_date,to_date,reason) VALUES(%s,%s,%s,%s)",
          (g.user["id"], d["from_date"], d["to_date"], d["reason"]), commit=True)
    return jsonify(id=i), 201


@app.put("/api/leaves/<int:i>")
@auth("admin")
def decide_leave(i):
    st = (request.json or {}).get("status")
    if st not in ("Approved", "Rejected"):
        return jsonify(error="Invalid status"), 400
    q("UPDATE leaves SET status=%s WHERE id=%s", (st, i), commit=True)
    return jsonify(ok=True)


# ---------- Announcements ----------
@app.get("/api/announcements")
@auth()
def announcements():
    return jsonify(q("SELECT * FROM announcements ORDER BY id DESC"))


@app.post("/api/announcements")
@auth("admin")
def add_announcement():
    d = request.json or {}
    if not d.get("title") or not d.get("body"):
        return jsonify(error="Title and message are required"), 400
    return jsonify(id=q("INSERT INTO announcements(title,body) VALUES(%s,%s)", (d["title"], d["body"]), commit=True)), 201


@app.delete("/api/announcements/<int:i>")
@auth("admin")
def del_announcement(i):
    q("DELETE FROM announcements WHERE id=%s", (i,), commit=True)
    return jsonify(ok=True)


# ---------- Attendance ----------
@app.get("/api/attendance")
@auth()
def attendance():
    s = ("SELECT a.id,a.officer_id,a.att_date,CAST(a.check_in AS CHAR) check_in,"
         "CAST(a.check_out AS CHAR) check_out,u.name officer_name "
         "FROM attendance a JOIN users u ON u.id=a.officer_id")
    if g.user["role"] == "admin":
        return jsonify(q(s + " ORDER BY a.att_date DESC, a.check_in DESC LIMIT 200"))
    return jsonify(q(s + " WHERE a.officer_id=%s ORDER BY a.att_date DESC LIMIT 60", (g.user["id"],)))


@app.post("/api/attendance/checkin")
@auth("officer")
def check_in():
    if q("SELECT id FROM attendance WHERE officer_id=%s AND att_date=CURDATE()", (g.user["id"],), one=True):
        return jsonify(error="You have already checked in today"), 400
    q("INSERT INTO attendance(officer_id,att_date,check_in) VALUES(%s,CURDATE(),CURTIME())", (g.user["id"],), commit=True)
    return jsonify(ok=True), 201


@app.post("/api/attendance/checkout")
@auth("officer")
def check_out():
    r = q("SELECT id,check_out FROM attendance WHERE officer_id=%s AND att_date=CURDATE()", (g.user["id"],), one=True)
    if not r:
        return jsonify(error="Check in first"), 400
    if r["check_out"] is not None:
        return jsonify(error="You have already checked out today"), 400
    q("UPDATE attendance SET check_out=CURTIME() WHERE id=%s", (r["id"],), commit=True)
    return jsonify(ok=True)


# ---------- Reports (admin) ----------
@app.get("/api/reports")
@auth("admin")
def reports():
    return jsonify(q("""
        SELECT u.id, u.name, u.department,
          COUNT(t.id) AS total,
          CAST(COALESCE(SUM(t.status='Completed'),0) AS UNSIGNED) AS completed,
          CAST(COALESCE(SUM(t.status='In Progress'),0) AS UNSIGNED) AS progress,
          CAST(COALESCE(SUM(t.status='Pending'),0) AS UNSIGNED) AS pending,
          CAST(COALESCE(SUM(t.status<>'Completed' AND t.due_date<CURDATE()),0) AS UNSIGNED) AS overdue,
          (SELECT COUNT(*) FROM attendance a WHERE a.officer_id=u.id
             AND MONTH(a.att_date)=MONTH(CURDATE()) AND YEAR(a.att_date)=YEAR(CURDATE())) AS present
        FROM users u LEFT JOIN tasks t ON t.officer_id=u.id
        WHERE u.role='officer' GROUP BY u.id, u.name, u.department ORDER BY u.name"""))


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG", "0") == "1")
