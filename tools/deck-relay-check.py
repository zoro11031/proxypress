"""Deck link sections and backwards-compatible text, without upstream access."""
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile

with tempfile.TemporaryDirectory(prefix="pp-deck-relay-") as cache:
    os.environ["CACHE"] = cache
    spec = importlib.util.spec_from_file_location("proxy_press_server", Path(__file__).resolve().parents[1] / "proxy-press-server.py")
    server = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(server)
    payload = {"name": "Fixture", "commanders": {"a": {"quantity": 1, "card": {"name": "Commander Eesha", "set": "jud", "cn": "8"}}}, "mainboard": {"b": {"quantity": 2, "card": {"name": "Forest"}}}}
    requests, replies = [], []
    def upstream(request, **kwargs):
        requests.append(request.full_url)
        return io.BytesIO(json.dumps(payload).encode())
    server.urllib.request.urlopen = upstream
    handler = object.__new__(server.Handler)
    handler.send = lambda status, body, *args: replies.append((status, body))
    handler.path = "/deck?u=https://moxfield.com/decks/fixture"
    handler.deck()
    assert replies[-1][0] == 200
    result = json.loads(replies[-1][1])
    assert result["text"] == "1 Commander Eesha (JUD) 8\n2 Forest"
    assert [row["section"] for row in result["rows"]] == ["commanders", "mainboard"]
    handler.deck()
    assert len(requests) == 1, "versioned cache did not preserve section metadata"
    payload = {"name": "Archive", "categories": [{"name": "Maybeboard", "includedInDeck": False}], "cards": [
        {"quantity": 1, "categories": ["Maybeboard"], "card": {"name": "Excluded"}},
        {"quantity": 2, "categories": ["Sideboard", "Tokens"], "card": {"name": "Treasure"}},
    ]}
    handler.path = "/deck?u=https://archidekt.com/decks/123"
    handler.deck()
    result = json.loads(replies[-1][1])
    assert result["text"] == "2 Treasure"
    assert result["rows"][0]["section"] == "Sideboard, Tokens"
    assert requests[-1] == "https://archidekt.com/api/decks/123/"
    print("PASS Python deck relay: compatible text, named sections, filtering and versioned cache")
