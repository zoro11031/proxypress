#!/usr/bin/env python3
"""Serves proxy-press.html and relays MPC Autofill searches to mpcfill.com.

mpcfill.com only accepts browser requests from its own site, so the page sends
searches here and this script forwards them. Images load directly from the
MPC Autofill CDN and do not pass through this script.

Usage: python3 proxy-press-server.py [port]   (default 8642)

Environment:
  HOST           interface to listen on (default 127.0.0.1)
  PORT           port (default 8642)
  BASIC_AUTH     "user:password" to require a login
  ALLOW_NO_AUTH  set to 1 to listen on a non-local interface without a login
  NO_BROWSER     set to 1 to skip opening a browser on start
"""
import base64
import hmac
import http.server
import json
import os
import signal
import sys
import time
import urllib.error
import urllib.request
import webbrowser

PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "proxy-press.html")
UPSTREAM = "https://mpcfill.com/"
ALLOWED = {"2/editorSearch/", "2/cards/", "2/sources/", "2/cardbacks/", "2/languages/", "2/DFCPairs/"}
MAX_BODY = 256 * 1024
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8642))
HOST = os.environ.get("HOST", "127.0.0.1")
AUTH = os.environ.get("BASIC_AUTH", "")
LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cards.scryfall.io https://img.mpcautofill.com https://cdn.mpcautofill.com",
    "connect-src 'self' data: blob: https://api.scryfall.com https://img.mpcautofill.com https://cdn.mpcautofill.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
])


class Handler(http.server.BaseHTTPRequestHandler):
    timeout = 30
    server_version = "ProxyPress"
    sys_version = ""

    def send(self, status, body, ctype, extra=()):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if not AUTH:
            return True
        expected = "Basic " + base64.b64encode(AUTH.encode()).decode()
        if hmac.compare_digest(self.headers.get("Authorization", "").encode(), expected.encode()):
            return True
        if self.headers.get("Authorization"):
            time.sleep(1)
        self.send(401, b"Login required", "text/plain", [("WWW-Authenticate", 'Basic realm="Proxy Press", charset="UTF-8"')])
        return False

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
                self.send(r.status, r.read(), "application/json")
        except urllib.error.HTTPError as e:
            self.send(e.code, e.read(), "application/json")
        except Exception:
            self.send(502, b'{"name":"Relay error","message":"Could not reach mpcfill.com"}', "application/json")

    def do_GET(self):
        if self.path == "/healthz":
            return self.send(200, b"ok", "text/plain")
        if not self.authorized():
            return
        if self.path.startswith("/mpc/"):
            return self.relay("GET")
        if self.path.split("?")[0] in ("/", "/proxy-press.html"):
            with open(PAGE, "rb") as f:
                return self.send(200, f.read(), "text/html; charset=utf-8", [("Content-Security-Policy", CSP)])
        self.send(404, b"Not found", "text/plain")

    def do_POST(self):
        if not self.authorized():
            return
        if self.path.startswith("/mpc/"):
            return self.relay("POST")
        self.send(405, b"Method not allowed", "text/plain")

    def log_message(self, fmt, *args):
        if not self.path.startswith(("/mpc/2/sources", "/healthz")):
            sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    if HOST not in LOCAL_HOSTS and not AUTH and not os.environ.get("ALLOW_NO_AUTH"):
        sys.exit("Refusing to listen on %s without a login. Set BASIC_AUTH=user:password "
                 "(or ALLOW_NO_AUTH=1 if something in front of this already handles it)." % (HOST or "all interfaces"))
    if AUTH and ":" not in AUTH:
        sys.exit("BASIC_AUTH must look like user:password")
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    http.server.ThreadingHTTPServer.daemon_threads = True
    server = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{'localhost' if HOST in LOCAL_HOSTS + ('0.0.0.0', '') else HOST}:{PORT}/"
    print(f"Proxy Press running at {url}{' (login required)' if AUTH else ''}  (Ctrl+C to stop)", flush=True)
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
