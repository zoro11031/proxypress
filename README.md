# Proxy Press

A fast, private, print-ready Magic: The Gathering proxy maker. Paste any decklist, pick high-resolution art, and generate ready-to-print sheets with perfect alignment, bleed, and cut guides—or export ready-to-order packages for professional cardstock printing.

Everything runs smoothly in your browser with zero bloat and no accounts. Your decks, presets, and artwork stay securely saved on your own machine.

![Proxy Press sheet preview](screenshots/print-preview.png)

---

## ✨ Features at a Glance

### ⚡ Import Decks Instantly
- **Import from anywhere:** Paste decklists or import links directly from Moxfield and Archidekt. Text files, MTG Arena, and MTGO exports work out of the box.
- **Automatic token generation:** Add all tokens and emblems required by your deck with a single click.
- **Easy sharing:** Package an entire deck—including high-res art and print layouts—into a single file to share with friends. When they import it, their own printer settings and alignment stay untouched.

### 🎨 High-Res Art & Custom Cards
- **Curated high-res artwork:** Proxy Press automatically finds the best high-DPI scans and renders from Scryfall and community autofill drives.
- **One-click art picker:** Browse dozens of alternate printings, retro borders, showcase frames, and borderless art variants.
- **Custom cards & local folders:** Create custom cards with authentic frame typography, upload your own images, or point Proxy Press to an offline folder of card art.

![Choosing high-resolution card artwork](screenshots/art-picker.png)

### 🖨️ Two Printing Workflows

#### 1. Print at Home
Generate print-ready PDFs tailored to standard Letter or A4 sheets with dual-sided alignment:
- **Smart bleed & crop marks:** Automatically generates bleed edge extensions and alignment guides so your cards never have white borders.
- **Front-and-back duplex alignment:** Calibrate front-to-back shift so card backs line up with card fronts every time.
- **Precision cutting tools:** Choose between manual cutting (rotary trimmer with corner tick marks) and automated craft cutting (Silhouette Cameo with optical registration marks and SVG cut lines).

![Choosing cutting tools and registration options](screenshots/cutting-workflow.png)

#### 2. Order Professional Prints
Prefer casino-grade cardstock delivered to your door? Switch to **Order prints** mode to prepare an order for MakePlayingCards:
- **Visual card gallery:** Review card fronts and chosen cardbacks side-by-side.
- **Autofill ready:** Export XML order files and download matching artwork formatted for the autofill desktop tool.

![Reviewing cards in Order Prints mode](screenshots/order-mode.png)

---

## 🚀 Quickstart

### Run locally

```sh
python3 proxy-press-server.py
```

This starts the local server and opens http://localhost:8642. 

> **Tip:** You can also double-click `proxy-press.html` to run completely serverless in any browser! Running with the python script is only required for community art search (due to site CORS protections) and deck-link importing.

### Host with Docker / Podman

Keep Proxy Press running on your home server or NAS with Docker Compose:

```sh
cp .env.example .env    # optional: set password or port
docker compose up -d    # or: podman compose up -d
```

#### Configuration Options

| Variable | Default | Purpose |
|---|---|---|
| `PASSWORD` | — | Optional password for the web login screen (`PROXY_PRESS_PASSWORD` in `.env`) |
| `BASIC_AUTH` | — | Optional `user:password` HTTP basic authentication prompt (`PROXY_PRESS_AUTH` in `.env`) |
| `ASSETS` | `./assets` | Folder of `fonts/` and `frames/<set>/` served to users (`/app/assets` in container) |
| `CACHE` | `./cache` | Folder for cached Scryfall card data and session key (`/app/cache` in container) |
| `HOST` | `127.0.0.1` (`0.0.0.0` in container) | Network interface to bind to (`PROXY_PRESS_BIND` in `.env`) |
| `PORT` | `8642` | Web port (`PROXY_PRESS_PORT` in `.env`) |

---

## 🃏 Card Maker Assets (Fonts & Frame Packs)

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

---

## 💡 Tips & Shortcuts

- **Multi-card selection:** In the sheet preview, click a card to select it, **Shift-click** to select a range, or **Ctrl/Cmd-click** to toggle multiple copies. On mobile or touchscreens, tap cards to toggle them.
- **Batch art changes:** Select copies and tap **Change selected art…** to swap art across all selected copies at once.
- **Always print at 100%:** When printing your PDF in your viewer or printer driver, make sure scaling is set to **100% / Actual Size** (disable "Fit to printable area") so cards match physical Magic dimensions (63 × 88 mm).
- **Automated craft cutting:** When using a Silhouette Cameo cutter, export the cut SVG and load it at 100% scale in Silhouette Studio. The exported registration marks line up with your printed sheets.
- **Backups & resets:** Your decks and settings live in your browser's IndexedDB. Use **⚙ (top right) → Save backup file…** to move your collection between computers. If you ever want a fresh start, use **⚙ → Return to defaults** to reset printer and preview settings while keeping your saved decks and artwork intact.

---

## ❤️ Special Thanks & Inspirations

Proxy Press stands on the shoulders of the amazing creators, tools, and communities that make Magic accessible to everyone:

- **[Scryfall](https://scryfall.com)** — For building the unbeatable gold standard in Magic data, card imagery, and developer APIs.
- **[MPC Autofill / MPCFill](https://mpcfill.com)** — The foundational community engine and high-resolution art repository that revolutionized custom card printing, along with all the talented artists who curate and contribute high-DPI drives.
- **[Proxxied](https://proxxied.com)** — For pioneering modern web proxy generation and inspiring clean, fast in-browser sheet layouts.
- **[Cry Cry](https://www.youtube.com/@crycryproxy)** — The go-to YouTube channel for MTG proxy crafting, paper testing, foil methods, and cutting guides that inspired our home print and plotter workflows.
- **[Magic Set Editor (MSE)](https://magicseteditor.boards.net)** — The classic open-source card suite whose typography conventions, frame definitions, and template packages paved the way for custom frames.
- **Card Conjurer & MTG.Design** — For pushing the boundaries of web-based card rendering and custom layouts.
- The **r/mpcproxies** and **r/magicproxies** communities — For endless inspiration, printer calibration techniques, and passion for the game.

---

## 📜 License

Proxy Press is free software licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).
