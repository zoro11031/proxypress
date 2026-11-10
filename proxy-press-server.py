#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Serves proxy-press.html and relays MPC Autofill searches to mpcfill.com.

mpcfill.com only accepts browser requests from its own site, so the page sends
searches here and this script forwards them. Images load directly from the
MPC Autofill CDN and do not pass through this script. Scryfall card data and
mana symbols are fetched through here too and kept, so repeat lookups are local.

Usage: python3 proxy-press-server.py [port]   (default 8642)

Environment:
  HOST        interface to listen on (default 127.0.0.1)
  PORT        port (default 8642)
  PASSWORD    show a sign-in page that asks for this password (optional)
  ASSETS      folder of fonts/ and frames/<set>/ served to signed-in users (default ./assets)
  BASIC_AUTH  "user:password" for a browser login prompt instead (optional)
  NO_BROWSER  set to 1 to skip opening a browser on start
  CACHE       folder for cached Scryfall card data (default ./cache)
"""
import base64
import hashlib
import hmac
import http.server
import ipaddress
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
OG_IMAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "og.png")
OG_DESCRIPTION = "Turn a decklist into print-ready Magic proxies. Print at home with bleed and cut guides, or order from MakePlayingCards."
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

symbol_locks, symbols_lock = {}, threading.Lock()


def symbol(name):
    """Scryfall's symbol list and SVGs, fetched once and kept in the cache."""
    with symbols_lock:
        lock = symbol_locks.setdefault(name, threading.Lock())
    with lock:
        hit = cache_get("sym:" + name, SYMBOL_TTL)
        if hit is not None:
            return hit.encode()
        try:
            body = fetch_symbol(name)
        except Exception:
            with symbols_lock:
                symbol_locks.pop(name, None)
            raise
        cache_put("sym:" + name, body.decode())
        return body


def fetch_symbol(name):
    if name == "index.json":
        with urllib.request.urlopen(urllib.request.Request("https://api.scryfall.com/symbology", headers={"Accept": "application/json", "User-Agent": "ProxyPress/1.0"}), timeout=30) as r:
            data = json.loads(r.read(MAX_UPSTREAM))
        body = json.dumps({s["symbol"]: "/sym/" + s["svg_uri"].rsplit("/", 1)[1].split("?")[0]
                           for s in data.get("data", []) if re.fullmatch(r"https://svgs\.scryfall\.io/card-symbols/[A-Z0-9]{1,12}\.svg(\?\d+)?", s.get("svg_uri") or "")}).encode()
    else:
        with urllib.request.urlopen(urllib.request.Request("https://svgs.scryfall.io/card-symbols/" + name, headers={"User-Agent": "ProxyPress/1.0"}), timeout=30) as r:
            body = r.read(256 * 1024 + 1)
        if len(body) > 256 * 1024 or b"<svg" not in body[:2048]:
            raise ValueError("not an svg")
    return body


CACHE = os.environ.get("CACHE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
CARD_TTL, SEARCH_TTL, MPC_TTL, SYMBOL_TTL = 14 * 86400, 3 * 86400, 2 * 86400, 14 * 86400
MEM_CACHE_BYTES, DISK_CACHE_FILES = 48 * 1024 * 1024, 60000
sf_lock, sf_last, mem_cache, mem_size, mem_lock = threading.Lock(), [0.0], {}, [0], threading.Lock()
disk_pruned = [0.0]


def session_secret():
    """Kept in the cache volume so logins survive restarts; changing PASSWORD signs everyone out."""
    path = os.path.join(CACHE, "session.key")
    try:
        with open(path, "rb") as f:
            key = f.read()
        if len(key) != 32:
            raise OSError
    except OSError:
        key = os.urandom(32)
        try:
            os.makedirs(CACHE, exist_ok=True)
            with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "wb") as f:
                f.write(key)
        except OSError:
            pass
    return hmac.new(key, PASSWORD.encode(), hashlib.sha256).digest()


SECRET = session_secret()


def cache_get(key, ttl):
    with mem_lock:
        hit = mem_cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    try:
        with open(os.path.join(CACHE, hashlib.sha256(key.encode()).hexdigest() + ".json"), "rb") as f:
            t, body = json.loads(f.read())
        if time.time() - t < ttl:
            cache_mem(key, t, body)
            return body
    except (OSError, ValueError):
        pass
    return None


def cache_mem(key, t, body):
    size = len(body if isinstance(body, str) else json.dumps(body))
    if size > 256 * 1024:
        return
    with mem_lock:
        if key in mem_cache:
            mem_size[0] -= mem_cache[key][2]
        while mem_cache and mem_size[0] + size > MEM_CACHE_BYTES:
            old = min(mem_cache, key=lambda k: mem_cache[k][0])
            mem_size[0] -= mem_cache.pop(old)[2]
        mem_cache[key] = (t, body, size)
        mem_size[0] += size


def cache_put(key, body):
    t = time.time()
    cache_mem(key, t, body)
    try:
        os.makedirs(CACHE, exist_ok=True)
        path = os.path.join(CACHE, hashlib.sha256(key.encode()).hexdigest() + ".json")
        tmp = f"{path}.{threading.get_ident()}.tmp"
        with open(tmp, "w") as f:
            json.dump([t, body], f)
        os.replace(tmp, path)
        # Hourly: drop expired files, then the oldest while over the file limit.
        with mem_lock:
            due = t - disk_pruned[0] > 3600
            if due:
                disk_pruned[0] = t
        if due:
            files = sorted((os.path.getmtime(p), p) for p in (os.path.join(CACHE, n) for n in os.listdir(CACHE) if n.endswith((".json", ".tmp"))))
            for n, (m, p) in enumerate(files):
                if t - m > CARD_TTL or len(files) - n > DISK_CACHE_FILES:
                    os.remove(p)
    except OSError:
        pass


def scryfall(path, body=None):
    """One request to api.scryfall.com, spaced 100 ms apart as Scryfall asks."""
    with sf_lock:
        wait = 0.1 - (time.time() - sf_last[0])
        if wait > 0:
            time.sleep(wait)
        sf_last[0] = time.time()
    req = urllib.request.Request("https://api.scryfall.com" + path, data=json.dumps(body).encode() if body is not None else None,
                                 method="POST" if body is not None else "GET",
                                 headers={"Accept": "application/json", "Content-Type": "application/json", "User-Agent": "ProxyPress/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read(MAX_UPSTREAM))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read(64 * 1024) or b"{}")


def ident_key(i):
    return "id:" + json.dumps({k: str(v).lower() for k, v in i.items()}, sort_keys=True)


def ident_match(i, c):
    if "id" in i:
        return c.get("id") == i["id"]
    if "collector_number" in i:
        return c.get("set") == str(i.get("set", "")).lower() and str(c.get("collector_number", "")).lower() == str(i["collector_number"]).lower()
    names = [c.get("name", "")] + [f.get("name", "") for f in c.get("card_faces") or []]
    return str(i.get("name", "")).lower() in [n.lower() for n in names] and ("set" not in i or c.get("set") == str(i["set"]).lower())


def collection(identifiers):
    """/cards/collection, answered card by card from the cache where possible."""
    data, todo = [], []
    for i in identifiers:
        hit = cache_get(ident_key(i), CARD_TTL)
        if hit is not None:
            data.append(hit)
        else:
            todo.append(i)
    not_found = []
    if todo:
        status, j = scryfall("/cards/collection", {"identifiers": todo})
        if status != 200:
            return status, j
        fresh, not_found = j.get("data") or [], j.get("not_found") or []
        for i in todo:
            c = next((c for c in fresh if ident_match(i, c)), None)
            if c is not None:
                cache_put(ident_key(i), c)
        data += fresh
    return 200, {"object": "list", "not_found": not_found, "data": data}


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
        "connect-src 'self' data: blob: https://api.scryfall.com https://cards.scryfall.io https://img.mpcautofill.com https://cdn.mpcautofill.com",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ])


LOGIN_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Proxy Press · Sign in</title>
<meta name="theme-color" content="#14161a"><!--head--><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#14161a;color:#e7e9ee;font:15px/1.4 system-ui,sans-serif}
form{background:#1c1f25;border:1px solid #2f343d;border-radius:12px;padding:26px;width:min(340px,calc(100vw - 32px));box-sizing:border-box}
h1{font-size:19px;margin:0 0 4px}h1 span{color:#e0a33a}p{color:#9aa1ad;font-size:13px;margin:0 0 16px}
label{display:block;margin-bottom:6px;font-size:13px}input:focus-visible,button:focus-visible{outline:2px solid #f2c26b;outline-offset:3px}input{width:100%%;box-sizing:border-box;background:#111317;border:1px solid #2f343d;border-radius:7px;padding:9px 10px;color:inherit;font:inherit}
button{margin-top:12px;width:100%%;background:#e0a33a;color:#1b1407;border:0;border-radius:7px;padding:9px;font:inherit;font-weight:600;cursor:pointer}
.err{color:#ff9c95;font-size:13px;margin:10px 0 0}</style></head><body>
<form method="post" action="/login"><h1>Proxy<span>Press</span></h1><p>Enter the password to continue.</p>
<input type="text" name="username" value="user" autocomplete="username" style="display:none" aria-hidden="true" tabindex="-1">
<label for="password">Password</label>
<input id="password" type="password" name="password" autocomplete="current-password" aria-label="Password" autofocus required>
<button type="submit">Sign in</button>%s</form></body></html>"""
LOGIN_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"


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
        peer = self.client_address[0]
        try:
            behind_proxy = ipaddress.ip_address(peer).is_private
        except ValueError:
            behind_proxy = False
        if not behind_proxy:
            return peer
        cf = self.headers.get("CF-Connecting-IP", "").strip()
        forwarded = self.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        return cf or forwarded or peer

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
        if not any(k == "Cross-Origin-Resource-Policy" for k, _ in extra):
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def preview_tags(self):
        host = self.headers.get("Host", "")
        base = ("https" if self.https() else "http") + "://" + host if re.fullmatch(r"[A-Za-z0-9.-]+(:\d{1,5})?", host) else ""
        tags = [("og:type", "website"), ("og:site_name", "Proxy Press"), ("og:title", "Proxy Press"), ("og:description", OG_DESCRIPTION),
                ("og:image", base + "/og.png"), ("og:image:width", "1200"), ("og:image:height", "630"), ("og:url", base + "/")]
        return ("\n".join(f'<meta property="{k}" content="{v}">' for k, v in tags)
                + f'\n<meta name="description" content="{OG_DESCRIPTION}">\n<meta name="twitter:card" content="summary_large_image">')

    def login_page(self, status, error=""):
        icon = ""
        try:
            with open(PAGE, encoding="utf-8") as f:
                m = re.search(r'<link rel="icon"[^>]*>', f.read(8192))
                icon = m.group(0) if m else ""
        except OSError:
            pass
        page = (LOGIN_PAGE % error).replace("<!--head-->", self.preview_tags() + icon)
        self.send(status, page.encode(), "text/html; charset=utf-8", [("Content-Security-Policy", LOGIN_CSP)])

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
        if self.path.startswith(("/mpc/", "/assets/", "/deck", "/sym/", "/sf/")):
            return self.send(401, b'{"name":"Signed out","message":"Sign in again"}', "application/json")
        if PASSWORD:
            return self.login_page(200)
        if self.headers.get("Authorization"):
            time.sleep(1)
        self.send(401, b"Login required", "text/plain", [("WWW-Authenticate", 'Basic realm="Proxy Press", charset="UTF-8"')])

    def login(self):
        ip = self.client_ip()
        if too_many_failures(ip):
            return self.login_page(429, '<p class="err" role="alert">Too many wrong passwords. Try again in 15 minutes.</p>')
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
        self.login_page(401, '<p class="err" role="alert">Wrong password.</p>')

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
        key = "mpc:" + method + ":" + path + ":" + hashlib.sha256(body or b"").hexdigest()
        hit = cache_get(key, MPC_TTL)
        if hit is not None:
            return self.send(200, hit.encode(), "application/json")
        req = urllib.request.Request(UPSTREAM + path, data=body, method=method, headers={
            "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "ProxyPress/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read(MAX_UPSTREAM + 1)
                if len(data) > MAX_UPSTREAM:
                    return self.send(502, b'{"name":"Relay error","message":"Response too large"}', "application/json")
                if r.status == 200:
                    cache_put(key, data.decode("utf-8", "replace"))
                self.send(r.status, data, "application/json")
        except urllib.error.HTTPError as e:
            self.send(e.code, e.read(64 * 1024), "application/json")
        except Exception:
            self.send(502, b'{"name":"Relay error","message":"Could not reach mpcfill.com"}', "application/json")

    def deck(self):
        url = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("u", [""])[0].strip()
        m = re.match(r"https?://(?:www\.)?(moxfield|archidekt)\.com/decks/([A-Za-z0-9_-]{1,40})", url)
        if not m:
            return self.send(400, b'{"message":"Paste a Moxfield or Archidekt deck link"}', "application/json")
        site, deck_id = m.groups()
        api = f"https://api2.moxfield.com/v2/decks/all/{deck_id}" if site == "moxfield" else f"https://archidekt.com/api/decks/{deck_id}/"
        try:
            with urllib.request.urlopen(urllib.request.Request(api, headers={"Accept": "application/json", "User-Agent": "ProxyPress/1.0"}), timeout=30) as r:
                j = json.loads(r.read(MAX_UPSTREAM))
        except urllib.error.HTTPError as e:
            msg = "Deck not found or not public" if e.code in (403, 404) else f"{site.title()} returned {e.code}"
            return self.send(502, json.dumps({"message": msg}).encode(), "application/json")
        except Exception:
            return self.send(502, json.dumps({"message": f"Could not reach {site.title()}"}).encode(), "application/json")
        line = lambda q, n, st, cn: f"{q} {n}" + (f" ({st.upper()}) {cn}" if st and cn else "")
        lines = []
        if site == "moxfield":
            for board in ("commanders", "companions", "mainboard", "sideboard"):
                for v in (j.get(board) or {}).values():
                    c = v.get("card") or {}
                    lines.append(line(v.get("quantity", 1), c.get("name", ""), c.get("set", ""), c.get("cn", "")))
        else:
            skip = {c.get("name") for c in j.get("categories") or [] if not c.get("includedInDeck") and c.get("name") != "Sideboard"}
            for v in j.get("cards") or []:
                cats = v.get("categories") or []
                if any(cat in skip for cat in cats):
                    continue
                c = v.get("card") or {}
                lines.append(line(v.get("quantity", 1), (c.get("oracleCard") or {}).get("name", ""), (c.get("edition") or {}).get("editioncode", ""), c.get("collectorNumber", "")))
        self.send(200, json.dumps({"name": j.get("name", ""), "text": "\n".join(l for l in lines if l.split(" ", 1)[1:] != [""])}).encode(), "application/json")

    def sf(self, method):
        try:
            self.sf_cached(method)
        except Exception:
            self.send(502, b"Could not reach Scryfall", "text/plain")

    def sf_cached(self, method):
        path = self.path[len("/sf"):]
        route = path.split("?")[0]
        if method == "POST":
            if route != "/cards/collection":
                return self.send(404, b'{"object":"error","details":"Not relayed"}', "application/json")
            try:
                length = int(self.headers.get("Content-Length") or 0)
                ids = json.loads(self.rfile.read(length)).get("identifiers") if 0 < length <= MAX_BODY else None
            except (ValueError, AttributeError):
                ids = None
            if not isinstance(ids, list) or not 0 < len(ids) <= 75 or not all(isinstance(i, dict) for i in ids):
                return self.send(400, b'{"object":"error","details":"Bad identifiers"}', "application/json")
            status, j = collection(ids)
        else:
            if not re.fullmatch(r"/cards/(named|search|[0-9a-f-]{36})|/symbology", route):
                return self.send(404, b'{"object":"error","details":"Not relayed"}', "application/json")
            ttl = SEARCH_TTL if route == "/cards/search" else CARD_TTL
            j = cache_get("get:" + path, ttl)
            status = 200
            if j is None:
                status, j = scryfall(path)
                if status == 200:
                    cache_put("get:" + path, j)
        self.send(status, json.dumps(j).encode(), "application/json")

    def do_GET(self):
        route = self.path.split("?")[0]
        if route == "/healthz":
            return self.send(200, b"ok", "text/plain")
        if route == "/og.png" and os.path.isfile(OG_IMAGE):
            with open(OG_IMAGE, "rb") as f:
                return self.send(200, f.read(), "image/png", [("Cache-Control", "public, max-age=86400"), ("Cross-Origin-Resource-Policy", "cross-origin")])
        if route == "/logout":
            return self.send(303, b"", "text/plain", [("Location", "/"), ("Set-Cookie", f"{COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax")])
        if not self.signed_in():
            return self.refuse()
        if route.startswith("/mpc/"):
            return self.relay("GET")
        if route == "/deck":
            try:
                return self.deck()
            except Exception:
                return self.send(502, b'{"message":"Could not read that deck"}', "application/json")
        if route.startswith("/sf/"):
            return self.sf("GET")
        if route.startswith("/sym/"):
            name = route[len("/sym/"):]
            if not re.fullmatch(r"index\.json|[A-Z0-9]{1,12}\.svg", name):
                return self.send(404, b"Not found", "text/plain")
            try:
                body = symbol(name)
            except Exception:
                return self.send(502, b"Could not reach Scryfall", "text/plain")
            if name == "index.json":
                return self.send(200, body, "application/json", [("Cache-Control", "private, max-age=86400")])
            return self.send(200, body, "image/svg+xml", [("Cache-Control", "private, max-age=2592000, immutable"), ("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")])
        if route == "/assets/manifest.json":
            return self.send(200, json.dumps(asset_manifest()).encode(), "application/json")
        if route.startswith("/assets/"):
            full, ctype = asset_path(route)
            if not full:
                return self.send(404, b"Not found", "text/plain")
            with open(full, "rb") as f:
                return self.send(200, f.read(), ctype, [("Cache-Control", "private, max-age=86400"), ("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")])
        if route in ("/", "/proxy-press.html"):
            with open(PAGE, "rb") as f:
                body = f.read()
            csp = page_csp(body)
            body = body.replace(b"</title>", b"</title>\n" + self.preview_tags().encode(), 1)
            return self.send(200, body, "text/html; charset=utf-8", [("Content-Security-Policy", csp)])
        self.send(404, b"Not found", "text/plain")

    do_HEAD = do_GET

    def do_POST(self):
        if self.path.split("?")[0] == "/login" and PASSWORD:
            return self.login()
        if not self.signed_in():
            return self.refuse()
        if self.path.startswith("/mpc/"):
            return self.relay("POST")
        if self.path.startswith("/sf/"):
            return self.sf("POST")
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
