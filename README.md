# Proxy Press

A single-page MTG proxy maker. Import a decklist or an MPC Autofill XML, choose art from Scryfall or MPC Autofill, and export a print-ready PDF with bleed and cut guides. Decks, presets and settings stay in your browser (IndexedDB). Nothing is stored on the server.

Two modes: **Print at home** (PDF with bleed, cut guides and double-sided backs, with re-feed instructions) and **Order prints** (an order file plus images for the autofill desktop tool, which places the order on MakePlayingCards.com).

To send a deck to someone who prints proxies, open **Cards → Share a print deck → Export deck & art (.json)**. The file includes this deck's quantities, front and back images, custom-card source art, and paper/layout settings. The recipient can drop it onto Proxy Press or choose **Import print deck…**. It adds a new deck and opens Print setup; their printer and calibration stay intact. They can use the shared layout or keep their own. Files include the art itself, so the original art links are not needed for printing. Print deck JSON files can be up to 2 GB.

## Run locally

```sh
python3 proxy-press-server.py
```

This opens http://localhost:8642. You can also open `proxy-press.html` directly; everything works except MPC Autofill art search, which needs the server because mpcfill.com only accepts searches from its own site.

No server? **Use local image folder** (Cards tab) searches a folder of MPC-style images on your computer and picks exact name matches automatically.

## Host with Docker / Podman

```sh
cp .env.example .env    # optional: PROXY_PRESS_AUTH=user:password
docker compose up -d    # or: podman compose up -d
```

The page is served on port 8642, published on `127.0.0.1` unless you set `PROXY_PRESS_BIND` (for example to the server's LAN IP). A login is optional; set one if the page is reachable beyond your home network, and put it behind HTTPS (Caddy, Traefik, nginx) so the login isn't sent unencrypted.

| Variable | Default | Purpose |
|---|---|---|
| `PASSWORD` | — | Optional sign-in page password (`PROXY_PRESS_PASSWORD` in `.env`) |
| `BASIC_AUTH` | — | Optional `user:password` browser login prompt instead |
| `HOST` | `127.0.0.1` (`0.0.0.0` in the image) | Interface to listen on |
| `PORT` | `8642` | Port |

Saved decks belong to the browser and the address they were made on. Use **⚙ (top right) → Export backup** to move them between browsers or addresses.
