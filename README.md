# Proxy Press

A single-page MTG proxy maker. Import a decklist or an MPC Autofill XML, choose art from Scryfall or MPC Autofill, and export a print-ready PDF with bleed and cut guides. Decks, presets and settings stay in your browser (IndexedDB). Nothing is stored on the server.

## Run locally

```sh
python3 proxy-press-server.py
```

This opens http://localhost:8642. You can also open `proxy-press.html` directly; everything works except MPC Autofill art search, which needs the server because mpcfill.com only accepts searches from its own site.

## Host with Docker / Podman

```sh
cp .env.example .env    # set PROXY_PRESS_AUTH=user:password
docker compose up -d    # or: podman compose up -d
```

The page is served on port 8642 behind a login. Put it behind a reverse proxy with HTTPS (Caddy, Traefik, nginx); without HTTPS the login is sent unencrypted.

| Variable | Default | Purpose |
|---|---|---|
| `BASIC_AUTH` | — | `user:password` login (required unless `HOST` is local) |
| `HOST` | `127.0.0.1` (`0.0.0.0` in the image) | Interface to listen on |
| `PORT` | `8642` | Port |
| `ALLOW_NO_AUTH` | — | `1` to skip the login when a proxy in front already handles it |

Saved decks belong to the browser and the address they were made on. Use **Data → Export backup** to move them between browsers or addresses.
