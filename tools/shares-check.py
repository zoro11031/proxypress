#!/usr/bin/env python3
"""Exercise public deck links against an isolated, password-protected server."""
import base64
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true', help='also open a public link in mobile Chromium')
    parser.add_argument('--server-root', type=Path, default=ROOT, help='server checkout to exercise')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='pp-shares-') as cache:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        env = {**os.environ, 'CACHE': cache, 'PASSWORD': 'share-check', 'BASIC_AUTH': '', 'NO_BROWSER': '1', 'PUBLIC_URL': 'https://proxy.example.com', 'SHARE_STORAGE_MB': '2', 'SHARE_DECK_MB': '1'}
        server = subprocess.Popen(['python3', 'proxy-press-server.py', str(port)], cwd=args.server_root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cookie = ''
        checks = 0
        def request(path, body=None, auth=True, mime='application/json', extra=None):
            conn = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
            headers = dict(extra or {})
            if auth and cookie:
                headers['Cookie'] = cookie
            if body is not None:
                headers['Content-Type'] = mime
                body = body if isinstance(body, bytes) else json.dumps(body).encode()
            conn.request('GET' if body is None else 'POST', path, body, headers)
            response = conn.getresponse()
            result = response.status, dict(response.getheaders()), response.read()
            conn.close()
            return result
        def check(ok, label):
            nonlocal checks
            checks += 1
            assert ok, label
        def draft():
            return json.loads(request('/shares', {})[2])['id']
        def upload(token, body=PNG):
            status, _, raw = request('/shares/'+token+'/images', body, mime='image/png')
            check(status == 200, 'image upload succeeds')
            return json.loads(raw)['hash']
        def document(hashes):
            return {'app':'proxy-press', 'version':1, 'type':'linked-deck', 'deck':{'name':'Shared <deck>', 'entries':[{'uid':'test','name':'Test','type':'Land','qty':100,'faces':[{'name':'Front','custom':'img-front'}]}]}, 'settings':{}, 'images':{'img-front':hashes}}
        try:
            for _ in range(100):
                try:
                    if request('/healthz', auth=False)[0] == 200:
                        break
                except OSError:
                    time.sleep(.05)
            status, headers, _ = request('/login', b'password=share-check', auth=False, mime='application/x-www-form-urlencoded')
            check(status == 303, 'sign in')
            cookie = headers['Set-Cookie'].split(';')[0]
            check(request('/shares', auth=False)[0] == 401, 'listing requires sign-in')
            check(request('/shares', {}, auth=False)[0] == 401, 'creation requires sign-in')
            check(request('/shares', {}, extra={'Origin':'https://elsewhere.example'})[0] == 403, 'cross-origin creation rejected')
            a, b = draft(), draft()
            check(len(a) == 32 and a != b, 'unguessable unique tokens')
            check(request('/share/'+a, auth=False)[0] == 404, 'drafts are private')
            digest = upload(a)
            check(digest == hashlib.sha256(PNG).hexdigest(), 'content hash')
            check(upload(b) == digest, 'images deduplicate across decks')
            with sqlite3.connect(Path(cache)/'shares.sqlite3') as db:
                check(db.execute('SELECT COUNT(*) FROM share_images').fetchone()[0] == 1, 'one stored image')
            status, _, raw = request('/shares/'+a, document(digest))
            check(status == 200 and json.loads(raw)['publicUrl'] == env['PUBLIC_URL'], 'publish uses public origin')
            check(request('/shares/'+b, document('f'*64))[0] == 400, 'unuploaded references cannot publish')
            check(request('/shares/'+b, document(digest))[0] == 200, 'publish second deck')
            server.terminate(); server.wait(timeout=10)
            server = subprocess.Popen(['python3', 'proxy-press-server.py', str(port)], cwd=args.server_root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(100):
                try:
                    if request('/healthz', auth=False)[0] == 200:
                        break
                except OSError:
                    time.sleep(.05)
            check(request('/share/'+a+'/images/'+digest, auth=False)[0] == 200, 'artwork survives server restart')
            check(request('/shares')[0] == 200, 'management session survives server restart')
            if args.browser:
                subprocess.run(['node', 'tools/console-check.js', '--url', f'http://127.0.0.1:{port}/share/{a}', '--probe', 'tools/shared-view-probe.js', '--width', '390', '--height', '844', '--screenshot', '/tmp/proxypress-public-share-mobile.png'], cwd=ROOT, check=True, timeout=170)
            status, headers, page = request('/share/'+a, auth=False)
            check(status == 200 and b'function layout' in page and b'public-url' in page, 'public app opens without password')
            check('https://proxy.example.com' in headers['Content-Security-Policy'], 'configured original origin allowed by CSP')
            status, _, raw = request('/share/'+a+'/deck.json', auth=False)
            check(status == 200 and len(raw) < 1000 and b'data:image' not in raw, 'manifest is small and reference-only')
            status, headers, raw = request('/share/'+a+'/images/'+digest, auth=False)
            check(status == 200 and raw == PNG and headers['Access-Control-Allow-Origin'] == '*', 'public image bytes and CORS')
            check(request('/share/'+a+'/images/'+'f'*64, auth=False)[0] == 404, 'image must belong to this deck')
            check(request('/share/'+a+'/shares', auth=False)[0] == 404, 'token grants no management access')
            check(request('/share/'+a+'/assets/manifest.json', auth=False)[0] == 200, 'public viewer can load frames and fonts')
            check(request('/shares/'+a+'/images', PNG, mime='image/png')[0] == 409, 'published snapshots are immutable')
            c = draft()
            large = PNG + b'a'*(600*1024)
            upload(c, large)
            status, _, raw = request('/shares/'+c+'/images', PNG+b'b'*(600*1024), mime='image/png')
            check(status == 413 and b'per-deck' in raw, 'per-deck quota is separate from total quota')
            check(request('/shares/'+c+'/delete', {})[0] == 200, 'cancel cleans a draft')
            for letter in (b'c', b'd'):
                token = draft(); upload(token, PNG+letter*(700*1024))
            token = draft()
            check(request('/shares/'+token+'/images', PNG+b'e'*(700*1024), mime='image/png')[0] == 507, 'total storage quota enforced')
            check(request('/shares/'+a+'/delete', {}, auth=False)[0] == 401, 'revocation requires sign-in')
            check(request('/shares/'+a+'/delete', {})[0] == 200, 'link revoked')
            check(request('/share/'+a, auth=False)[0] == 404, 'revoked page unavailable')
            check(request('/share/'+a+'/images/'+digest, auth=False)[0] == 404, 'revoked images unavailable')
            check(request('/share/'+b+'/images/'+digest, auth=False)[0] == 200, 'other shared deck retains deduplicated art')
            check(request('/shares/'+b+'/delete', {})[0] == 200, 'last image reference removed')
            with sqlite3.connect(Path(cache)/'shares.sqlite3') as db:
                check(db.execute('SELECT COUNT(*) FROM share_images WHERE hash=?', (digest,)).fetchone()[0] == 0, 'unreferenced artwork reclaimed')
        finally:
            server.terminate()
            server.wait(timeout=10)
        print(f'PASS - {checks} share checks')


if __name__ == '__main__':
    main()
