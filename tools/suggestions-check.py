"""Check the Python suggestions relay without network access."""
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile

with tempfile.TemporaryDirectory(prefix="pp-suggestions-") as cache:
    os.environ["CACHE"] = cache
    spec = importlib.util.spec_from_file_location("proxy_press_server", Path(__file__).resolve().parents[1] / "proxy-press-server.py")
    server = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(server)
    payload = {"similar": ["Mission Briefing"], "container": {"json_dict": {"cardlists": [
        {"tag": "topcommanders", "cardviews": [{"name": "Excluded commander"}]},
        {"tag": "highliftcards", "cardviews": [{"name": "Torrential Gearhulk"}]},
    ]}}}
    requests, replies = [], []

    def upstream(request, **kwargs):
        requests.append(request.full_url)
        return io.BytesIO(json.dumps(payload).encode())

    server.urllib.request.urlopen = upstream
    handler = object.__new__(server.Handler)
    handler.send = lambda status, body, *args: replies.append((status, body))
    handler.suggestions("snapcaster-mage")
    assert replies[-1][0] == 200
    assert [card["name"] for card in json.loads(replies[-1][1])["cards"]] == ["Mission Briefing", "Torrential Gearhulk"]
    assert requests == ["https://json.edhrec.com/pages/cards/snapcaster-mage.json"]
    handler.suggestions("snapcaster-mage")
    assert len(requests) == 1, "cache was bypassed"
    handler.suggestions("https://evil.example")
    assert replies[-1][0] == 404 and len(requests) == 1
    handler.path = "/suggest/snapcaster-mage"
    handler.signed_in = lambda: False
    handler.refuse = lambda: replies.append((401, b""))
    handler.do_GET()
    assert replies[-1][0] == 401 and len(requests) == 1
    server.urllib.request.urlopen = lambda *args, **kwargs: io.BytesIO(b"x" * (2 * 1024 * 1024 + 1))
    handler.suggestions("oversized-response")
    assert replies[-1][0] == 502
    print("PASS Python suggestions: related data, caching, fixed host, sign-in and response limit")
