# Proxy Press

A single-page MTG proxy maker. Import a decklist or an MPC Autofill XML, choose art from Scryfall or MPC Autofill, and export a print-ready PDF with bleed and cut guides. Decks, presets and settings stay in your browser (IndexedDB). Nothing is stored on the server.

Two modes: **Print at home** (PDF with bleed, cut guides and double-sided backs, with re-feed instructions) and **Order prints** (an order file plus images for the autofill desktop tool, which places the order on MakePlayingCards.com).

To send a deck to someone who prints proxies, open **Cards → Images, custom cards & sharing → Save deck package…**. The file includes this deck's quantities, front and back images, custom-card source art, and paper/layout settings. The recipient can drop it onto Proxy Press or choose **Import deck… → Choose file…**. It adds a new deck and opens Print setup; their printer and calibration stay intact. They can use the shared layout or keep their own. Files include the art itself, so the original art links are not needed for printing. Print deck JSON files can be up to 2 GB.

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
| `BASIC_AUTH` | — | Optional `user:password` browser login prompt instead (`PROXY_PRESS_AUTH` in `.env`) |
| `ASSETS` | `./assets` | Folder of `fonts/` and `frames/<set>/` served to users (`/app/assets` in container) |
| `CACHE` | `./cache` | Folder for cached Scryfall card data and session key (`/app/cache` in container) |
| `HOST` | `127.0.0.1` (`0.0.0.0` in the image) | Interface to listen on (`PROXY_PRESS_BIND` in `.env`) |
| `PORT` | `8642` | Port (`PROXY_PRESS_PORT` in `.env`) |

## Card Maker Assets (Fonts & Frame Packs)

Proxy Press includes an in-browser Custom Card Maker for designing custom cards, tokens, and proxies with authentic Magic typography and layouts.

Out of the box, the card maker uses fallback web fonts and vector frames. To render authentic, print-quality cards matching real card frames (Modern M15, Classic Retro, Planeswalker, etc.), supply font and frame packs in an `assets/` directory.

### Asset Folder Structure

```
assets/
├── fonts/
│   ├── Beleren2016-Bold.ttf          # Modern card title
│   ├── Beleren Small Caps.ttf        # Modern type line & P/T
│   ├── PlantinMTProRg.TTF            # Rules text (regular)
│   ├── PlantinMTProRgIt.TTF          # Flavor & reminder text (italic)
│   ├── PlantinMTProBold.TTF          # Bold rules & P/T numbers
│   ├── Magicmedieval-pRV1.ttf        # Retro card title
│   ├── Matrix Bold.ttf               # Retro type line & 8th Edition frames
│   ├── Relay-Medium.ttf              # Collector line & copyright
│   └── ModMatrix.ttf                 # Modern P/T font
└── frames/
    ├── magic-m15.mse-style/          # Modern frame (2014–present)
    ├── magic-m15-planeswalker.mse-style/
    ├── magic-new.mse-style/          # Modern frame (2003–2014)
    ├── magic-old.mse-style/          # Classic retro frame (1993–2003)
    └── ...                           # Other .mse-style packages
```

### Acquiring Fonts

Fonts can be TrueType (`.ttf`), OpenType (`.otf`), or Web Open Font (`.woff`/`.woff2`).

Standard MTG typography bundles are distributed with the **Magic Set Editor (MSE)** installer and community template packs. Installing Magic Set Editor on Windows copies these fonts to your system font directory, or they can be retrieved from MSE font archives online.

Proxy Press automatically inspects filenames in `assets/fonts/` and assigns them to the appropriate typography slot:

| Slot | Target Font | Common Filenames Recognized |
|---|---|---|
| Modern Name | Beleren Bold | `Beleren2016-Bold.ttf`, `Beleren-Bold.ttf`, `beleren-bold_P1.01.ttf` |
| Modern Type & P/T | Beleren Small Caps | `Beleren Small Caps.ttf`, `belerensmallcaps-bold.ttf` |
| Rules Text | Plantin / MPlantin Regular | `PlantinMTProRg.TTF`, `mplantin.ttf`, `Plantin.ttf` |
| Flavor / Reminder | Plantin / MPlantin Italic | `PlantinMTProRgIt.TTF`, `mplantinit.ttf` |
| Bold Text | Plantin Bold | `PlantinMTProBold.TTF` |
| Retro Name | Magic Medieval | `Magicmedieval-pRV1.ttf`, `MAGIC.TTF`, `magmed.ttf` |
| Retro Type / 8th Ed | Matrix Bold | `Matrix Bold.ttf`, `MatrixBold.ttf`, `matrixb.ttf` |
| Collector Line | Relay Medium / Gotham | `Relay-Medium.ttf`, `Gotham Medium.otf` |
| Future Sight | Eurostile / Futura | `Eurostile.ttf`, `Microgramma.ttf`, `Futura.ttf` |
| Matrix P/T | ModMatrix | `ModMatrix.ttf` |

*Note: Mana symbols and loyalty icons do not need font files; Proxy Press fetches and caches the official SVG symbols directly from Scryfall.*

### Acquiring Frame Packs

Proxy Press natively parses **Magic Set Editor** (`.mse-style`) frame packages.

Each frame package is a folder containing a `style` layout definition and the card frame artwork (`wcard.jpg`, `ucard.jpg`, `bcard.jpg`, `wpt.png`, `border_mask.png`, etc.). You can find these packages in MSE template repositories, community MSE packs, or export them from an existing MSE installation.

Common supported frame directories placed in `assets/frames/`:

- `magic-m15.mse-style` — Modern card frame (2014–present)
- `magic-m15-planeswalker.mse-style` — Modern Planeswalker frame
- `magic-new.mse-style` — Modern frame (2003–2014 / 8th Edition)
- `magic-old.mse-style` — Classic retro frame (1993–2003)
- `magic-m15classic-hires.mse-style` — Modern M15 layout with retro card textures
- `magic-m15-commander.mse-style` — Legendary crown / commander styling
- `magic-tenth.mse-style` — 10th Edition frame (oval art window)
- `magic-future.mse-style` — Future Sight frames
- `magic-old-abu.mse-style` — Alpha / Beta / Unlimited vintage layout

### Loading Assets

- **With Docker / Compose**: Mount your assets folder as a read-only volume:
  ```yaml
  volumes:
    - ./assets:/app/assets:ro,z
    - cache:/app/cache
  ```
- **With Local Python Server**: Place the `assets/` folder in the project root directory, or point the `ASSETS` environment variable to it:
  ```sh
  ASSETS=/path/to/my/assets python3 proxy-press-server.py
  ```
- **In-Browser (No Server Hosting)**: You can also load fonts and frames directly into the browser without any server configuration. In the **Cards → Custom card maker** tab, use the **Load…** buttons to pick font files or drag and drop `.mse-style` folders directly into your browser. They are saved in your browser's IndexedDB.


Saved decks belong to the browser and the address they were made on. Use **⚙ (top right) → Save backup file…** to move them between browsers or addresses.

In the preview, click a card copy to select it, Shift-click for a range, or Ctrl/Cmd-click to toggle copies. On a phone, tap copies to toggle them. Choose **Change selected art…** to update only those copies, or **Select all copies** to include every copy of the selected cards. The selection actions follow you between Edit and Preview on mobile.

Use **⚙ → Return to defaults** to reset printer, layout, art-search, and preview settings while keeping your decks, artwork, and saved presets.

## License

Proxy Press is free software licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).

