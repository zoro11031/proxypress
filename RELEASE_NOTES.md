# Proxy Press v1.0.2

A free, easy MTG proxy maker. Drop in a decklist, pick your art, and get a print-ready PDF with proper bleed and cut lines—or an order file ready for MakePlayingCards.

---

### 💡 Which download is best for you?

- **Best for normal desktop users (Easiest & Recommended):**
  - **Windows:** Download and run **`Proxy-Press-1.0.2.exe`** (or `Proxy-Press-1.0.2.msi`).
  - **Linux:** Download **`Proxy-Press-1.0.2.AppImage`**, make it executable (`chmod +x`), and double-click to launch.
  *(Everything is pre-packaged with all fonts, frames, and art search tools—no setup, accounts, or password needed).*

- **Best for home servers or NAS (Docker):**
  - If you want Proxy Press running 24/7 on your local network (Unraid, TrueNAS, Synology, Raspberry Pi), the **Docker container** (`docker compose up -d`) is preferred.

- **For Linux users who prefer system package managers:**
  - **Debian / Ubuntu (.deb):** `sudo apt install ./Proxy-Press-1.0.2.deb`
  - **Fedora / openSUSE / RHEL (.rpm):** `sudo dnf install ./Proxy-Press-1.0.2.rpm`
  - **Arch / CachyOS / Manjaro (.pacman):** `sudo pacman -U Proxy-Press-1.0.2.pacman` (or unpack `proxypress-bin-aur.tar.gz` and run `makepkg -si`)

---

### What's New in v1.0.2

- **Bug Fixes & Accessibility:**
  - **Export Button Usability:** Fixed the "Review & export" header button so that clicking it while on the Export tab immediately triggers the PDF export (matching the "Download PDF" panel button). The header button label also dynamically switches between "Review & export" (on steps 1–3) and "Download PDF" (on step 4) so both buttons work seamlessly.
  - **Welcome Tour Navigation:** Fixed closure state scoping in `openTour` so Next and Back buttons reliably step through all guide slides in both directions.
  - **Dock Icon Scale:** Scaled the fan-of-cards icon to fill 90% vertical height and 98.6% horizontal span (`505×456` in a `512×512` canvas), eliminating excessive transparent margins so the app icon matches full-sized desktop dock icons.
  - **Art Picker Layout Stability:** Added fixed card aspect-ratio (`63/88`) placeholders for lazy-loaded images, preventing page reflow and jumpy layout shifts as image thumbnails decode.
  - **Keyboard Art Selection:** Added `Enter` and `Space` key handlers to art picker figures for accessible keyboard navigation.
  - **Deck Import Enhancements:** Expanded Moxfield board support to include Oathbreaker signature spells, attractions, stickers, and contraptions; added fallback card name resolution for Archidekt custom/token cards.
  - **Letter Portrait Preset:** Tuned preset bleed to 0.75 mm so Letter portrait comfortably fits a standard 9-card (3×3) grid with 5.4 mm margins.
  - **Theme Polish:** Added theme-matched amber text selection (`::selection`).

---

### ❤️ Special Thanks & Supporting MPC Autofill

Huge thanks to **[MPC Autofill / MPCFill](https://mpcfill.com)** above all. None of this would exist without their database, community drives, and the artists creating and sharing high-DPI card renders.

If you use the autofill tool or community drives, please consider **[supporting their server and maintenance costs on Patreon](https://www.patreon.com/mpcfill)**.

Special thanks also to:
- **[ProxyJak](https://proxyjak.com)** — Quality proxy cardstock.
- **[Cry Cry](https://www.youtube.com/@crycryproxy)** — Essential YouTube tutorials on paper choices, foiling, and cutter setup.
- **[Scryfall](https://scryfall.com)** — The card data API powering the MTG community.
- **[Proxxied](https://proxxied.com)** — In-browser preview and sheet layout inspiration.
- **Magic Set Editor & Card Conjurer / MTG.Design** — Card framing and typography foundations.

---

### ⚖️ Fair Use Notice
Code is free software under [GPL-3.0-or-later](LICENSE). Card frames, symbol vectors, and fonts bundled in `assets/` are proprietary trademarks/copyrights of their respective owners and are bundled in accordance with fair use for non-commercial, personal card crafting and proxy printing.
