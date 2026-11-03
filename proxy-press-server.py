#!/usr/bin/env python3
"""Serves proxy-press.html and relays MPC Autofill searches to mpcfill.com.

mpcfill.com only accepts browser requests from its own site, so the page sends
searches here and this script forwards them. Images load directly from the
MPC Autofill CDN and do not pass through this script.

Usage: python3 proxy-press-server.py [port]   (default 8642)

Environment:
  HOST        interface to listen on (default 127.0.0.1)
  PORT        port (default 8642)
  PASSWORD    show a sign-in page that asks for this password (optional)
  ASSETS      folder of fonts/ and frames/<set>/ served to signed-in users (default ./assets)
  BASIC_AUTH  "user:password" for a browser login prompt instead (optional)
  NO_BROWSER  set to 1 to skip opening a browser on start
"""
import base64
import hashlib
import hmac
import http.server
import json
import os
import re
import signal
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "proxy-press.html")
UPSTREAM = "https://mpcfill.com/"
ALLOWED = {"2/editorSearch/", "2/cards/", "2/sources/", "2/cardbacks/", "2/languages/", "2/DFCPairs/"}
MAX_BODY = 256 * 1024
MAX_UPSTREAM = 20 * 1024 * 1024
MAX_CONNECTIONS = 64
SESSION_DAYS = 30
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8642))
HOST = os.environ.get("HOST", "127.0.0.1")
AUTH = os.environ.get("BASIC_AUTH", "")
PASSWORD = os.environ.get("PASSWORD", "")
SECRET = os.urandom(32)
LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")
COOKIE = "pp_session"
ASSETS = os.path.realpath(os.environ.get("ASSETS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets"))
ASSET_TYPES = {".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
               ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", "": "text/plain; charset=utf-8"}


def asset_manifest():
    fonts, frames = [], []
    font_dir, frame_dir = os.path.join(ASSETS, "fonts"), os.path.join(ASSETS, "frames")
    if os.path.isdir(font_dir):
        fonts = sorted(f for f in os.listdir(font_dir) if os.path.splitext(f)[1].lower() in (".ttf", ".otf", ".woff", ".woff2"))
    if os.path.isdir(frame_dir):
        for name in sorted(os.listdir(frame_dir)):
            d = os.path.join(frame_dir, name)
            if os.path.isfile(os.path.join(d, "style")):
                frames.append({"name": name, "files": sorted(f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f)))})
    return {"fonts": fonts, "frames": frames}


def asset_path(route):
    rel = urllib.parse.unquote(route[len("/assets/"):])
    full = os.path.realpath(os.path.join(ASSETS, rel))
    if not full.startswith(ASSETS + os.sep) or not os.path.isfile(full):
        return None, None
    ext = os.path.splitext(full)[1].lower()
    if ext not in ASSET_TYPES or (ext == "" and os.path.basename(full) != "style"):
        return None, None
    return full, ASSET_TYPES[ext]

failures, failures_lock = {}, threading.Lock()


def too_many_failures(ip):
    now = time.time()
    with failures_lock:
        for k in list(failures):
            failures[k] = [t for t in failures[k] if now - t < 900]
            if not failures[k]:
                del failures[k]
        return len(failures.get(ip, [])) >= 8 or sum(map(len, failures.values())) >= 200


def record_failure(ip):
    with failures_lock:
        failures.setdefault(ip, []).append(time.time())


def make_session():
    exp = str(int(time.time()) + SESSION_DAYS * 86400)
    return exp + "." + hmac.new(SECRET, exp.encode(), hashlib.sha256).hexdigest()


def valid_session(value):
    exp, _, sig = (value or "").partition(".")
    if not exp.isdigit() or int(exp) < time.time():
        return False
    return hmac.compare_digest(sig, hmac.new(SECRET, exp.encode(), hashlib.sha256).hexdigest())


def page_csp(page_bytes):
    hashes = " ".join("'sha256-%s'" % base64.b64encode(hashlib.sha256(m.encode()).digest()).decode()
                      for m in re.findall(r"<script>(.*?)</script>", page_bytes.decode(), re.S))
    return "; ".join([
        "default-src 'self'",
        f"script-src 'self' {hashes} https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://cards.scryfall.io https://svgs.scryfall.io https://img.mpcautofill.com https://cdn.mpcautofill.com",
        "connect-src 'self' data: blob: https://api.scryfall.com https://img.mpcautofill.com https://cdn.mpcautofill.com",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ])


LOGIN_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Proxy Press · Sign in</title>
<meta name="theme-color" content="#14161a"><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#14161a;color:#e7e9ee;font:15px/1.4 system-ui,sans-serif}
form{background:#1c1f25;border:1px solid #2f343d;border-radius:12px;padding:26px;width:min(340px,calc(100vw - 32px));box-sizing:border-box}
h1{font-size:19px;margin:0 0 4px}h1 span{color:#e0a33a}p{color:#9aa1ad;font-size:13px;margin:0 0 16px}
input{width:100%%;box-sizing:border-box;background:#111317;border:1px solid #2f343d;border-radius:7px;padding:9px 10px;color:inherit;font:inherit}
button{margin-top:12px;width:100%%;background:#e0a33a;color:#1b1407;border:0;border-radius:7px;padding:9px;font:inherit;font-weight:600;cursor:pointer}
.err{color:#ff9c95;font-size:13px;margin:10px 0 0}</style></head><body>
<form method="post" action="/login"><h1>Proxy<span>Press</span></h1><p>Enter the password to continue.</p>
<input type="password" name="password" autocomplete="current-password" aria-label="Password" autofocus required>
<button type="submit">Sign in</button>%s</form></body></html>"""
LOGIN_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.slots = threading.BoundedSemaphore(MAX_CONNECTIONS)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        super().process_request(request, client_address)

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


class Handler(http.server.BaseHTTPRequestHandler):
    timeout = 30
    server_version = "ProxyPress"
    sys_version = ""

    def client_ip(self):
        cf = self.headers.get("CF-Connecting-IP", "").strip()
        forwarded = self.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        return cf or forwarded or self.client_address[0]

    def https(self):
        return self.headers.get("X-Forwarded-Proto") == "https"

    def send(self, status, body, ctype, extra=()):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if not any(k == "Cache-Control" for k, _ in extra):
            self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        if self.https():
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def login_page(self, status, error=""):
        self.send(status, (LOGIN_PAGE % error).encode(), "text/html; charset=utf-8", [("Content-Security-Policy", LOGIN_CSP)])

    def signed_in(self):
        if PASSWORD:
            for part in self.headers.get("Cookie", "").split(";"):
                name, _, value = part.strip().partition("=")
                if name == COOKIE and valid_session(value):
                    return True
            return False
        if AUTH:
            expected = "Basic " + base64.b64encode(AUTH.encode()).decode()
            return hmac.compare_digest(self.headers.get("Authorization", "").encode(), expected.encode())
        return True

    def refuse(self):
        if self.path.startswith(("/mpc/", "/assets/")):
            return self.send(401, b'{"name":"Signed out","message":"Sign in again"}', "application/json")
        if PASSWORD:
            return self.login_page(200)
        if self.headers.get("Authorization"):
            time.sleep(1)
        self.send(401, b"Login required", "text/plain", [("WWW-Authenticate", 'Basic realm="Proxy Press", charset="UTF-8"')])

    def login(self):
        ip = self.client_ip()
        if too_many_failures(ip):
            return self.login_page(429, '<p class="err">Too many wrong passwords. Try again in 15 minutes.</p>')
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if not 0 <= length <= 4096:
            return self.send(413, b"Too large", "text/plain")
        given = urllib.parse.parse_qs(self.rfile.read(length).decode("utf-8", "replace")).get("password", [""])[0]
        if hmac.compare_digest(given.encode(), PASSWORD.encode()):
            secure = "; Secure" if self.https() else ""
            cookie = f"{COOKIE}={make_session()}; Max-Age={SESSION_DAYS * 86400}; Path=/; HttpOnly; SameSite=Lax{secure}"
            return self.send(303, b"", "text/plain", [("Location", "/"), ("Set-Cookie", cookie)])
        record_failure(ip)
        time.sleep(1)
        self.login_page(401, '<p class="err">Wrong password.</p>')

    def relay(self, method):
        path = self.path[len("/mpc/"):]
        if path.split("?")[0] not in ALLOWED:
            return self.send(404, b'{"name":"Not found","message":"Endpoint not relayed"}', "application/json")
        body = None
        if method == "POST":
            try:
                length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                length = -1
            if not 0 <= length <= MAX_BODY:
                return self.send(413, b'{"name":"Too large","message":"Request body too large"}', "application/json")
            body = self.rfile.read(length)
        req = urllib.request.Request(UPSTREAM + path, data=body, method=method, headers={
            "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "ProxyPress/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read(MAX_UPSTREAM + 1)
                if len(data) > MAX_UPSTREAM:
                    return self.send(502, b'{"name":"Relay error","message":"Response too large"}', "application/json")
                self.send(r.status, data, "application/json")
        except urllib.error.HTTPError as e:
            self.send(e.code, e.read(64 * 1024), "application/json")
        except Exception:
            self.send(502, b'{"name":"Relay error","message":"Could not reach mpcfill.com"}', "application/json")

    def do_GET(self):
        route = self.path.split("?")[0]
        if route == "/healthz":
            return self.send(200, b"ok", "text/plain")
        if route == "/logout":
            return self.send(303, b"", "text/plain", [("Location", "/"), ("Set-Cookie", f"{COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax")])
        if not self.signed_in():
            return self.refuse()
        if route.startswith("/mpc/"):
            return self.relay("GET")
        if route == "/assets/manifest.json":
            return self.send(200, json.dumps(asset_manifest()).encode(), "application/json")
        if route.startswith("/assets/"):
            full, ctype = asset_path(route)
            if not full:
                return self.send(404, b"Not found", "text/plain")
            with open(full, "rb") as f:
                return self.send(200, f.read(), ctype, [("Cache-Control", "private, max-age=86400")])
        if route in ("/", "/proxy-press.html"):
            with open(PAGE, "rb") as f:
                body = f.read()
            return self.send(200, body, "text/html; charset=utf-8", [("Content-Security-Policy", page_csp(body))])
        self.send(404, b"Not found", "text/plain")

    do_HEAD = do_GET

    def do_POST(self):
        if self.path.split("?")[0] == "/login" and PASSWORD:
            return self.login()
        if not self.signed_in():
            return self.refuse()
        if self.path.startswith("/mpc/"):
            return self.relay("POST")
        self.send(405, b"Method not allowed", "text/plain")

    def log_message(self, fmt, *args):
        if not self.path.startswith(("/mpc/2/sources", "/healthz")):
            sys.stderr.write("%s %s\n" % (self.client_ip(), fmt % args))


if __name__ == "__main__":
    if AUTH and ":" not in AUTH:
        sys.exit("BASIC_AUTH must look like user:password")
    if HOST not in LOCAL_HOSTS and not (AUTH or PASSWORD):
        print("No login set: anyone who can reach this address can use it. Set PASSWORD to require one.", flush=True)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    server = Server((HOST, PORT), Handler)
    url = f"http://{'localhost' if HOST in LOCAL_HOSTS + ('0.0.0.0', '') else HOST}:{PORT}/"
    mode = " (password page)" if PASSWORD else " (login required)" if AUTH else ""
    print(f"Proxy Press running at {url}{mode}  (Ctrl+C to stop)", flush=True)
    if not os.environ.get("NO_BROWSER"):
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        server.serve_forever()
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        server.server_close()
