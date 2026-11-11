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
  PUBLIC_URL  public origin for share links, e.g. https://proxy.example.com
  SHARE_STORAGE_MB  total stored share artwork budget (default 20480)
  SHARE_DECK_MB  artwork budget per shared deck (default 1024)
"""
import base64
import contextlib
import hashlib
import hmac
import html
import http.server
import ipaddress
import json
import os
import re
import signal
import sqlite3
import sys
import threading
import time
import unicodedata
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
    return json.loads(asset_manifest_data()[0])


manifest_cache, manifest_lock = [0, None, None], threading.Lock()


def asset_manifest_data():
    font_dir, frame_dir = os.path.join(ASSETS, "fonts"), os.path.join(ASSETS, "frames")
    mt = max((os.path.getmtime(d) for d in (font_dir, frame_dir) if os.path.isdir(d)), default=0)
    with manifest_lock:
        if manifest_cache[1] is not None and manifest_cache[0] == mt:
            return manifest_cache[1], manifest_cache[2]
    fonts, frames = [], []
    if os.path.isdir(font_dir):
        fonts = sorted(f for f in os.listdir(font_dir) if os.path.splitext(f)[1].lower() in (".ttf", ".otf", ".woff", ".woff2"))
    if os.path.isdir(frame_dir):
        for name in sorted(os.listdir(frame_dir)):
            d = os.path.join(frame_dir, name)
            style_file = os.path.join(d, "style")
            if os.path.isfile(style_file):
                item = {"name": name, "files": sorted(f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f)))}
                try:
                    with open(style_file, "r", encoding="utf-8", errors="replace") as sf:
                        item["style"] = sf.read()
                except OSError:
                    pass
                frames.append(item)
    body = json.dumps({"fonts": fonts, "frames": frames}).encode()
    etag = f'"{hashlib.sha256(body).hexdigest()[:16]}"'
    with manifest_lock:
        manifest_cache[:] = [mt, body, etag]
    return body, etag


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
CARD_TTL, SEARCH_TTL, MPC_TTL, SYMBOL_TTL, DECK_TTL = 14 * 86400, 3 * 86400, 2 * 86400, 14 * 86400, 1800
MEM_CACHE_BYTES, DISK_CACHE_FILES = 48 * 1024 * 1024, 60000
sf_lock, sf_last, mem_cache, mem_size, mem_lock = threading.Lock(), [0.0], {}, [0], threading.Lock()
disk_pruned = [0.0]
SHARE_BYTES = max(1, int(os.environ.get("SHARE_STORAGE_MB", 20480))) * 1048576
SHARE_DECK_BYTES = max(1, int(os.environ.get("SHARE_DECK_MB", 1024))) * 1048576
SHARE_TOKEN = r"[A-Za-z0-9_-]{32}"
share_lock = threading.Lock()
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")
if PUBLIC_URL:
    public = urllib.parse.urlsplit(PUBLIC_URL)
    if public.scheme not in ("http", "https") or not public.hostname or public.username or public.password or public.path or public.query or public.fragment:
        sys.exit("PUBLIC_URL must be an http(s) origin, such as https://proxy.example.com")
    if not re.fullmatch(r"[A-Za-z0-9.:-]+", public.hostname):
        sys.exit("PUBLIC_URL must have a valid domain or IP address")
    try:
        public.port
    except ValueError:
        sys.exit("PUBLIC_URL must have a valid port")


@contextlib.contextmanager
def share_db():
    os.makedirs(CACHE, exist_ok=True)
    db = sqlite3.connect(os.path.join(CACHE, "shares.sqlite3"), timeout=30)
    try:
        db.execute("PRAGMA foreign_keys=ON")
        with db:
            db.execute("CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, created INTEGER NOT NULL, document TEXT)")
            db.execute("CREATE TABLE IF NOT EXISTS share_images (hash TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS share_refs (share TEXT REFERENCES shares(id) ON DELETE CASCADE, image TEXT REFERENCES share_images(hash), PRIMARY KEY(share,image))")
            db.execute("CREATE TABLE IF NOT EXISTS instance_art (id INTEGER PRIMARY KEY, image TEXT REFERENCES share_images(hash), thumb TEXT REFERENCES share_images(hash), card TEXT NOT NULL, oracle TEXT NOT NULL, name TEXT NOT NULL, face TEXT NOT NULL, kind TEXT NOT NULL, search TEXT NOT NULL, bleed REAL NOT NULL, created INTEGER NOT NULL, UNIQUE(image,oracle,face))")
            yield db
    finally:
        db.close()


def prune_shares(db):
    db.execute("DELETE FROM shares WHERE document IS NULL AND created < ?", (int(time.time()) - 86400,))
    db.execute("DELETE FROM share_images WHERE hash NOT IN (SELECT image FROM share_refs) AND hash NOT IN (SELECT image FROM instance_art UNION SELECT thumb FROM instance_art WHERE thumb IS NOT NULL)")


def art_name(name):
    text = unicodedata.normalize("NFKD", str(name).lower().replace("æ", "ae").replace("œ", "oe"))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in text if not unicodedata.combining(c))).strip()


def art_image(mime, body):
    head = body[:4096].lstrip(b"\xef\xbb\xbf \t\r\n")
    return {"image/png": body.startswith(b"\x89PNG\r\n\x1a\n"), "image/jpeg": body.startswith(b"\xff\xd8\xff"),
            "image/gif": body.startswith((b"GIF87a", b"GIF89a")), "image/bmp": body.startswith(b"BM"),
            "image/webp": body.startswith(b"RIFF") and body[8:12] == b"WEBP",
            "image/avif": body[4:8] == b"ftyp" and (b"avif" in body[:64] or b"avis" in body[:64]),
            "image/svg+xml": head.startswith((b"<svg", b"<?xml")) and b"<svg" in head}.get(mime, False)


def shared_document(token):
    with share_db() as db:
        row = db.execute("SELECT document FROM shares WHERE id=? AND document IS NOT NULL", (token,)).fetchone()
    return row[0] if row else None


def valid_share_document(doc):
    if not isinstance(doc, dict) or doc.get("app") != "proxy-press" or doc.get("type") != "linked-deck" or doc.get("version") != 1:
        return False
    d, images, settings = doc.get("deck"), doc.get("images"), doc.get("settings")
    if not isinstance(d, dict) or not isinstance(images, dict) or not isinstance(settings, dict) or len(images) > 4000:
        return False
    entries = d.get("entries")
    if not isinstance(entries, list) or not 1 <= len(entries) <= 2000:
        return False
    keys, count = set(), 0
    for e in entries:
        if not isinstance(e, dict) or type(e.get("qty")) is not int or not 0 <= e["qty"] <= 999:
            return False
        count += e["qty"]
        if not isinstance(e.get("faces"), list) or not 1 <= len(e["faces"]) <= 8:
            return False
        for f in e["faces"]:
            if not isinstance(f, dict) or not isinstance(f.get("custom"), str):
                return False
            keys.add(f["custom"])
            t = f.get("template")
            if t is not None:
                if not isinstance(t, dict):
                    return False
                keys.update(t[k] for k in ("artKey", "frameKey", "popKey") if isinstance(t.get(k), str))
    for f in (d.get("cardback"), {"custom": settings.get("backImage")}):
        if isinstance(f, dict) and isinstance(f.get("custom"), str):
            keys.add(f["custom"])
    return 0 < count <= 20000 and keys <= images.keys() and all(isinstance(k, str) and re.fullmatch(r"[\w-]{1,64}", k) and isinstance(v, str) and re.fullmatch(r"[a-f0-9]{64}", v) for k, v in images.items())


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
        "connect-src 'self' data: blob: https://api.scryfall.com https://cards.scryfall.io https://img.mpcautofill.com https://cdn.mpcautofill.com" + (" " + PUBLIC_URL if PUBLIC_URL else ""),
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ])


page_cache, page_lock = {}, threading.Lock()


def page_response(host, https, preview_tags_fn):
    mtime = os.path.getmtime(PAGE) if os.path.isfile(PAGE) else 0
    key = (mtime, host, https, PUBLIC_URL)
    with page_lock:
        hit = page_cache.get(key)
    if hit:
        return hit
    with open(PAGE, "rb") as f:
        body = f.read()
    csp = page_csp(body)
    body = body.replace(b"</title>", b"</title>\n" + preview_tags_fn().encode(), 1)
    body = body.replace(b"</head>", ('<meta name="public-url" content="' + html.escape(PUBLIC_URL, quote=True) + '"></head>').encode(), 1)
    etag = f'"{hashlib.sha256(body).hexdigest()[:16]}"'
    res = (body, csp, etag)
    with page_lock:
        page_cache.clear()
        page_cache[key] = res
    return res


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
        etag = next((v for k, v in extra if k == "ETag"), None)
        inm = self.headers.get("If-None-Match")
        if status == 200 and etag and inm and etag in [x.strip() for x in inm.split(",")]:
            self.send_response(304)
            for k, v in extra:
                if k in ("ETag", "Cache-Control", "Vary"):
                    self.send_header(k, v)
            self.end_headers()
            return
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
        if self.path.startswith(("/mpc/", "/assets/", "/deck", "/sym/", "/sf/", "/shares", "/art")):
            return self.send(401, b'{"name":"Signed out","message":"Sign in again"}', "application/json")
        if PASSWORD:
            return self.login_page(200)
        if self.headers.get("Authorization"):
            time.sleep(1)
        self.send(401, b"Login required", "text/plain", [("WWW-Authenticate", 'Basic realm="Proxy Press", charset="UTF-8"')])

    def share_json(self, status, data):
        return self.send(status, json.dumps(data, ensure_ascii=True).encode(), "application/json")

    def share_api(self, route):
        try:
            if self.command in ("GET", "HEAD") and route == "/shares":
                with share_lock, share_db() as db:
                    rows = db.execute("SELECT id,created,document FROM shares WHERE document IS NOT NULL ORDER BY created DESC").fetchall()
                items = [{"id": token, "created": created, "name": str(json.loads(doc).get("deck", {}).get("name", "Shared deck"))[:300]} for token, created, doc in rows]
                return self.share_json(200, {"shares": items, "publicUrl": PUBLIC_URL})
            origin = self.headers.get("Origin")
            if self.headers.get("Sec-Fetch-Site") == "cross-site" or (origin and urllib.parse.urlsplit(origin).netloc != self.headers.get("Host")):
                return self.share_json(403, {"message": "Open Proxy Press on this server to create or remove links."})
            try:
                length = int(self.headers.get("Content-Length", "-1"))
            except ValueError:
                length = -1
            upload = re.fullmatch(r"/shares/(" + SHARE_TOKEN + r")/images", route)
            if not 0 <= length <= (MAX_UPSTREAM if upload else MAX_BODY * 4):
                self.close_connection = True
                return self.share_json(413, {"message": "This image or deck is too large to share."})
            body = self.rfile.read(length)
            if len(body) != length:
                return self.share_json(400, {"message": "The upload was interrupted. Try again."})
            with share_lock, share_db() as db:
                if route == "/shares" and self.command == "POST":
                    prune_shares(db)
                    if db.execute("SELECT COUNT(*) FROM shares").fetchone()[0] >= 1000:
                        return self.share_json(409, {"message": "Remove an old share link before creating another."})
                    token = base64.urlsafe_b64encode(os.urandom(24)).decode()
                    db.execute("INSERT INTO shares VALUES (?,?,NULL)", (token, int(time.time())))
                    return self.share_json(201, {"id": token})
                match = re.fullmatch(r"/shares/(" + SHARE_TOKEN + r")(/images|/delete)?", route)
                if not match:
                    return self.share_json(404, {"message": "Share link not found."})
                token, action = match.groups()
                row = db.execute("SELECT document FROM shares WHERE id=?", (token,)).fetchone()
                if not row:
                    return self.share_json(404, {"message": "Share link not found."})
                if action == "/delete":
                    db.execute("DELETE FROM shares WHERE id=?", (token,))
                    prune_shares(db)
                    return self.share_json(200, {"removed": True})
                if row[0] is not None:
                    return self.share_json(409, {"message": "This link is already ready. Create a new link to share changes."})
                if upload:
                    mime = self.headers.get("Content-Type", "").split(";")[0].lower()
                    if not body or mime not in ("image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/bmp", "image/svg+xml"):
                        return self.share_json(400, {"message": "Please choose valid card artwork."})
                    digest = hashlib.sha256(body).hexdigest()
                    linked = db.execute("SELECT 1 FROM share_refs WHERE share=? AND image=?", (token, digest)).fetchone()
                    deck_bytes = db.execute("SELECT COALESCE(SUM(length(data)),0) FROM share_images JOIN share_refs ON image=hash WHERE share=?", (token,)).fetchone()[0]
                    if not linked and deck_bytes + length > SHARE_DECK_BYTES:
                        return self.share_json(413, {"message": "This deck exceeds the per-deck artwork limit. Split it into smaller decks."})
                    if not db.execute("SELECT 1 FROM share_images WHERE hash=?", (digest,)).fetchone():
                        used = db.execute("SELECT COALESCE(SUM(length(data)),0) FROM share_images").fetchone()[0]
                        if used + length > SHARE_BYTES:
                            return self.share_json(507, {"message": "Share storage is full. Remove an old share link and try again."})
                        db.execute("INSERT INTO share_images VALUES (?,?,?)", (digest, mime, body))
                    db.execute("INSERT OR IGNORE INTO share_refs VALUES (?,?)", (token, digest))
                    return self.share_json(200, {"hash": digest})
                try:
                    doc = json.loads(body)
                except (ValueError, UnicodeError):
                    doc = None
                if not valid_share_document(doc):
                    return self.share_json(400, {"message": "This shared deck is incomplete or too large."})
                refs = {r[0] for r in db.execute("SELECT image FROM share_refs WHERE share=?", (token,))}
                if not set(doc["images"].values()) <= refs:
                    return self.share_json(400, {"message": "Some artwork has not finished uploading. Try again."})
                db.execute("UPDATE shares SET document=? WHERE id=?", (json.dumps(doc, ensure_ascii=True), token))
                return self.share_json(200, {"id": token, "path": "/share/" + token, "publicUrl": PUBLIC_URL})
        except (OSError, sqlite3.Error):
            return self.share_json(507, {"message": "Could not save this share. Check the server's storage and try again."})

    def art_api(self, route):
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        match = re.fullmatch(r"/art/([1-9][0-9]{0,12})/(image|thumb|delete)", route)
        try:
            if self.command in ("GET", "HEAD"):
                with share_db() as db:
                    if route == "/art":
                        q = art_name(query.get("q", [""])[0][:300])
                        kind = query.get("kind", ["CARD"])[0]
                        rows = db.execute("SELECT id,name,face,bleed,length(data) FROM instance_art JOIN share_images ON image=hash WHERE instr(search,?)>0 AND kind=? ORDER BY created DESC,id DESC LIMIT 30", (q, kind)).fetchall() if q else []
                        return self.share_json(200, {"art": [{"id": i, "name": name, "face": face, "bleed": bleed, "size": size} for i, name, face, bleed, size in rows]})
                    if match and match[2] in ("image", "thumb"):
                        row = db.execute("SELECT mime,data FROM share_images JOIN instance_art ON hash=CASE WHEN ?='thumb' THEN COALESCE(thumb,image) ELSE image END WHERE id=?", (match[2], int(match[1]))).fetchone()
                        if row:
                            etag = f'"{match[1]}-{match[2]}"'
                            return self.send(200, row[1], row[0], [("ETag", etag), ("Cache-Control", "private, max-age=2592000, immutable"), ("Content-Security-Policy", "default-src 'none'; sandbox")])
                return self.share_json(404, {"message": "Artwork not found."})
            origin = self.headers.get("Origin")
            if self.headers.get("Sec-Fetch-Site") == "cross-site" or origin and urllib.parse.urlsplit(origin).netloc != self.headers.get("Host"):
                return self.share_json(403, {"message": "Open Proxy Press on this server to share artwork."})
            try:
                length = int(self.headers.get("Content-Length", "-1"))
            except ValueError:
                length = -1
            limit = 256 * 1024 if match else MAX_UPSTREAM
            if not 0 <= length <= limit:
                self.close_connection = True
                return self.share_json(413, {"message": "Artwork must be 20 MB or smaller."})
            body = self.rfile.read(length)
            if len(body) != length:
                return self.share_json(400, {"message": "The artwork upload was interrupted."})
            if match and match[2] == "delete":
                with share_lock, share_db() as db:
                    db.execute("DELETE FROM instance_art WHERE id=?", (int(match[1]),))
                    prune_shares(db)
                return self.share_json(200, {"removed": True})
            mime = self.headers.get("Content-Type", "").split(";")[0].lower()
            if not body or not art_image(mime, body):
                return self.share_json(400, {"message": "Choose valid card artwork."})
            card = None
            if route == "/art":
                card_id = query.get("card", [""])[0]
                if not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", card_id):
                    return self.share_json(400, {"message": "Choose a card match before sharing this artwork."})
                card = cache_get(ident_key({"id": card_id}), CARD_TTL)
                if not isinstance(card, dict):
                    status, card = scryfall("/cards/" + card_id)
                    if status != 200 or not isinstance(card, dict) or card.get("id") != card_id:
                        return self.share_json(400, {"message": "This card match could not be verified. Try another printing."})
                    cache_put(ident_key({"id": card_id}), card)
                try:
                    index = int(query.get("face", ["0"])[0])
                    bleed = float(query.get("bleed", ["0"])[0])
                except ValueError:
                    index, bleed = -1, -1
                faces = [card] if card.get("image_uris") else card.get("card_faces", [])
                if not 0 <= index < len(faces) or not 0 <= bleed <= 20:
                    return self.share_json(400, {"message": "Choose a valid card face and bleed."})
                face = faces[index].get("name", card.get("name", ""))
            elif not match or match[2] != "thumb":
                return self.share_json(404, {"message": "Artwork not found."})
            digest = hashlib.sha256(body).hexdigest()
            with share_lock, share_db() as db:
                if card:
                    oracle = card.get("oracle_id") or card["id"]
                    duplicate = db.execute("SELECT id FROM instance_art WHERE image=? AND oracle=? AND face=?", (digest, oracle, face)).fetchone()
                    if not duplicate and db.execute("SELECT COUNT(*) FROM instance_art").fetchone()[0] >= 100000:
                        return self.share_json(409, {"message": "Remove an old upload before adding more shared artwork."})
                if match and not db.execute("SELECT 1 FROM instance_art WHERE id=?", (int(match[1]),)).fetchone():
                    return self.share_json(404, {"message": "Artwork not found."})
                if not db.execute("SELECT 1 FROM share_images WHERE hash=?", (digest,)).fetchone():
                    used = db.execute("SELECT COALESCE(SUM(length(data)),0) FROM share_images").fetchone()[0]
                    if used + length > SHARE_BYTES:
                        return self.share_json(507, {"message": "Artwork storage is full. Remove old shared decks or uploaded art."})
                    db.execute("INSERT INTO share_images VALUES (?,?,?)", (digest, mime, body))
                if card:
                    kind = "TOKEN" if re.search(r"token|emblem", card.get("layout", "")) else "CARD"
                    db.execute("INSERT INTO instance_art (image,card,oracle,name,face,kind,search,bleed,created) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(image,oracle,face) DO NOTHING", (digest, card["id"], oracle, card["name"], face, kind, art_name(face), bleed, int(time.time())))
                    art_id = db.execute("SELECT id FROM instance_art WHERE image=? AND oracle=? AND face=?", (digest, oracle, face)).fetchone()[0]
                else:
                    art_id = int(match[1])
                    db.execute("UPDATE instance_art SET thumb=? WHERE id=?", (digest, art_id))
                prune_shares(db)
            return self.share_json(200, {"id": art_id})
        except (OSError, sqlite3.Error, urllib.error.URLError):
            return self.share_json(503, {"message": "Could not save or search shared artwork. Your deck still keeps its image."})

    def public_share(self, route):
        match = re.fullmatch(r"/share/(" + SHARE_TOKEN + r")(?:/(.*))?", route)
        if not match:
            return None
        token, path = match.groups()
        try:
            doc = shared_document(token)
            if doc is None:
                self.send(404, b"This share link was removed or is not ready.", "text/plain")
                return False
            if path == "deck.json":
                etag = f'"{hashlib.sha256(doc.encode()).hexdigest()[:16]}"'
                self.send(200, doc.encode(), "application/json", [("ETag", etag), ("Cache-Control", "public, max-age=60"), ("Access-Control-Allow-Origin", "*")])
                return False
            if path and re.fullmatch(r"images/[a-f0-9]{64}", path):
                with share_db() as db:
                    image = db.execute("SELECT mime,data FROM share_images JOIN share_refs ON image=hash WHERE share=? AND hash=?", (token, path[7:])).fetchone()
                if image:
                    etag = f'"{path[7:]}"'
                    self.send(200, image[1], image[0], [("ETag", etag), ("Cache-Control", "public, max-age=31536000, immutable"), ("Content-Security-Policy", "default-src 'none'; sandbox"), ("Access-Control-Allow-Origin", "*"), ("Cross-Origin-Resource-Policy", "cross-origin")])
                else:
                    self.send(404, b"Image not found", "text/plain")
                return False
            allowed = not path or path == "deck" or path.startswith(("assets/", "mpc/", "sf/", "sym/", "suggest/"))
            if not allowed:
                self.send(404, b"Not found", "text/plain")
                return False
            self.path = "/" + (path or "") + ("?" + self.path.split("?", 1)[1] if "?" in self.path else "")
            return True
        except (OSError, sqlite3.Error):
            self.share_json(503, {"message": "Shared decks are temporarily unavailable. Try again."})
            return False

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
            extra = [("Cache-Control", "private, max-age=86400"), ("ETag", f'"{hashlib.sha256(hit.encode()).hexdigest()[:16]}"')] if method == "GET" else []
            return self.send(200, hit.encode(), "application/json", extra)
        req = urllib.request.Request(UPSTREAM + path, data=body, method=method, headers={
            "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "ProxyPress/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read(MAX_UPSTREAM + 1)
                if len(data) > MAX_UPSTREAM:
                    return self.send(502, b'{"name":"Relay error","message":"Response too large"}', "application/json")
                if r.status == 200:
                    cache_put(key, data.decode("utf-8", "replace"))
                extra = [("Cache-Control", "private, max-age=86400"), ("ETag", f'"{hashlib.sha256(data).hexdigest()[:16]}"')] if method == "GET" and r.status == 200 else []
                self.send(r.status, data, "application/json", extra)
        except urllib.error.HTTPError as e:
            self.send(e.code, e.read(64 * 1024), "application/json")
        except Exception:
            self.send(502, b'{"name":"Relay error","message":"Could not reach mpcfill.com"}', "application/json")

    def deck(self):
        url = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("u", [""])[0].strip()
        m = re.match(r"https?://(?:www\.)?(moxfield|archidekt)\.com/decks/([A-Za-z0-9_-]{1,40})", url)
        if not m:
            return self.send(400, b'{"message":"Paste a Moxfield or Archidekt deck link"}', "application/json")
        key = "deck:" + url
        hit = cache_get(key, DECK_TTL)
        if hit is not None:
            body = hit.encode() if isinstance(hit, str) else json.dumps(hit).encode()
            return self.send(200, body, "application/json", [("Cache-Control", "private, max-age=300")])
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
            for board in ("commanders", "companions", "signatureSpells", "mainboard", "sideboard", "attractions", "stickers", "contraptions"):
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
                name = (c.get("oracleCard") or {}).get("name") or c.get("name") or ""
                lines.append(line(v.get("quantity", 1), name, (c.get("edition") or {}).get("editioncode", ""), c.get("collectorNumber", "")))
        out = json.dumps({"name": j.get("name", ""), "text": "\n".join(l for l in lines if l.split(" ", 1)[1:] != [""])}).encode()
        cache_put(key, out.decode("utf-8", "replace"))
        self.send(200, out, "application/json", [("Cache-Control", "private, max-age=300")])

    def suggestions(self, slug):
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,159}", slug):
            return self.send(404, b"Not found", "text/plain")
        key = "suggest:" + slug
        hit = cache_get(key, SEARCH_TTL)
        if hit is not None:
            body = json.dumps(hit).encode()
            return self.send(200, body, "application/json", [("Cache-Control", "private, max-age=86400"), ("ETag", f'"{hashlib.sha256(body).hexdigest()[:16]}"')])
        try:
            req = urllib.request.Request(f"https://json.edhrec.com/pages/cards/{slug}.json", headers={"Accept": "application/json", "User-Agent": "ProxyPress/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                body = r.read(2 * 1024 * 1024 + 1)
            if len(body) > 2 * 1024 * 1024:
                raise ValueError("Response too large")
            data = json.loads(body)
            cards = {}
            def add(name, score, kind):
                if isinstance(name, str) and 0 < len(name) <= 300 and name not in cards:
                    cards[name] = {"name": name, "score": score, "kind": kind}
            for i, name in enumerate(data.get("similar", [])[:24]):
                add(name, 80 - i, "Similar card")
            for group in data.get("container", {}).get("json_dict", {}).get("cardlists", []):
                base = {"highliftcards": 60, "topcards": 30}.get(group.get("tag"))
                if base:
                    for i, card in enumerate(group.get("cardviews", [])[:20]):
                        add(card.get("name"), base - i, "Often played together")
            result = {"cards": list(cards.values())[:64]}
            cache_put(key, result)
            out = json.dumps(result).encode()
            return self.send(200, out, "application/json", [("Cache-Control", "private, max-age=86400"), ("ETag", f'"{hashlib.sha256(out).hexdigest()[:16]}"')])
        except urllib.error.HTTPError as e:
            if e.code == 404:
                result = {"cards": []}
                cache_put(key, result)
                out = json.dumps(result).encode()
                return self.send(200, out, "application/json", [("Cache-Control", "private, max-age=86400"), ("ETag", f'"{hashlib.sha256(out).hexdigest()[:16]}"')])
        except Exception:
            pass
        self.send(502, b'{"message":"Suggestions are unavailable right now"}', "application/json")

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
            if not re.fullmatch(r"/cards/(named|search|autocomplete|[0-9a-f-]{36})|/symbology", route):
                return self.send(404, b'{"object":"error","details":"Not relayed"}', "application/json")
            ttl = SEARCH_TTL if route in ("/cards/search", "/cards/autocomplete") else CARD_TTL
            j = cache_get("get:" + path, ttl)
            status = 200
            if j is None:
                status, j = scryfall(path)
                if status == 200:
                    cache_put("get:" + path, j)
        body = json.dumps(j).encode()
        extra = []
        if status == 200 and method == "GET":
            extra = [("Cache-Control", f"private, max-age={3600 if route in ('/cards/search', '/cards/autocomplete') else 86400}"),
                     ("ETag", f'"{hashlib.sha256(body).hexdigest()[:16]}"')]
        self.send(status, body, "application/json", extra)

    def do_GET(self):
        route = self.path.split("?")[0]
        if route == "/healthz":
            return self.send(200, b"ok", "text/plain")
        if route == "/og.png" and os.path.isfile(OG_IMAGE):
            with open(OG_IMAGE, "rb") as f:
                return self.send(200, f.read(), "image/png", [("Cache-Control", "public, max-age=86400"), ("Cross-Origin-Resource-Policy", "cross-origin")])
        if route == "/logout":
            return self.send(303, b"", "text/plain", [("Location", "/"), ("Set-Cookie", f"{COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax")])
        public = self.public_share(route) if route.startswith("/share/") else None
        if public is False:
            return
        if not public and not self.signed_in():
            return self.refuse()
        route = self.path.split("?")[0]
        if route == "/art" or route.startswith("/art/"):
            return self.art_api(route)
        if route == "/shares":
            return self.share_api(route)
        if route.startswith("/mpc/"):
            return self.relay("GET")
        if route == "/deck":
            try:
                return self.deck()
            except Exception:
                return self.send(502, b'{"message":"Could not read that deck"}', "application/json")
        if route.startswith("/sf/"):
            return self.sf("GET")
        if route.startswith("/suggest/"):
            return self.suggestions(route[len("/suggest/"):])
        if route.startswith("/sym/"):
            name = route[len("/sym/"):]
            if not re.fullmatch(r"index\.json|[A-Z0-9]{1,12}\.svg", name):
                return self.send(404, b"Not found", "text/plain")
            try:
                body = symbol(name)
            except Exception:
                return self.send(502, b"Could not reach Scryfall", "text/plain")
            etag = f'"{hashlib.sha256(body).hexdigest()[:16]}"'
            if name == "index.json":
                return self.send(200, body, "application/json", [("ETag", etag), ("Cache-Control", "private, max-age=86400")])
            return self.send(200, body, "image/svg+xml", [("ETag", etag), ("Cache-Control", "private, max-age=2592000, immutable"), ("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")])
        if route == "/assets/manifest.json":
            body, etag = asset_manifest_data()
            return self.send(200, body, "application/json", [("ETag", etag), ("Cache-Control", "private, max-age=3600")])
        if route.startswith("/assets/"):
            full, ctype = asset_path(route)
            if not full:
                return self.send(404, b"Not found", "text/plain")
            try:
                stat = os.stat(full)
                etag = f'"{int(stat.st_mtime):x}-{stat.st_size:x}"'
                inm = self.headers.get("If-None-Match")
                if inm and etag in [x.strip() for x in inm.split(",")]:
                    return self.send(200, b"", ctype, [("ETag", etag), ("Cache-Control", "private, max-age=86400")])
                with open(full, "rb") as f:
                    return self.send(200, f.read(), ctype, [("ETag", etag), ("Cache-Control", "private, max-age=86400"), ("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")])
            except OSError:
                return self.send(404, b"Not found", "text/plain")
        if route in ("/", "/proxy-press.html"):
            body, csp, etag = page_response(self.headers.get("Host", ""), self.https(), self.preview_tags)
            return self.send(200, body, "text/html; charset=utf-8", [("Content-Security-Policy", csp), ("Cache-Control", "no-cache"), ("ETag", etag)])
        self.send(404, b"Not found", "text/plain")

    do_HEAD = do_GET

    def do_POST(self):
        if self.path.split("?")[0] == "/login" and PASSWORD:
            return self.login()
        route = self.path.split("?")[0]
        public = None
        if re.fullmatch(r"/share/" + SHARE_TOKEN + r"/(mpc|sf)/.*", route):
            public = self.public_share(route)
            if public is False:
                return
        if not public and not self.signed_in():
            return self.refuse()
        if route == "/art" or route.startswith("/art/"):
            return self.art_api(route)
        if self.path.split("?")[0].startswith("/shares"):
            return self.share_api(self.path.split("?")[0])
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
