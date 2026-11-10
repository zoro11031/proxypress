# Proxy Press v1.0.1

A free, easy MTG proxy maker. Drop in a decklist, pick your art, and get a print-ready PDF with proper bleed and cut lines—or an order file ready for MakePlayingCards.

---

### 💡 Which download is best for you?

- **Best for normal desktop users (Easiest & Recommended):**
  - **Windows:** Download and run **`Proxy-Press-1.0.1.exe`** (or `Proxy-Press-1.0.1.msi`).
  - **Linux:** Download **`Proxy-Press-1.0.1.AppImage`**, make it executable (`chmod +x`), and double-click to launch.
  *(Everything is pre-packaged with all fonts, frames, and art search tools—no setup, accounts, or password needed).*

- **Best for home servers or NAS (Docker):**
  - If you want Proxy Press running 24/7 on your local network (Unraid, TrueNAS, Synology, Raspberry Pi), the **Docker container** (`docker compose up -d`) is preferred.

- **For Linux users who prefer system package managers:**
  - **Debian / Ubuntu (.deb):** `sudo apt install ./Proxy-Press-1.0.1.deb`
  - **Fedora / openSUSE / RHEL (.rpm):** `sudo dnf install ./Proxy-Press-1.0.1.rpm`
  - **Arch / CachyOS / Manjaro (.pacman):** `sudo pacman -U Proxy-Press-1.0.1.pacman` (or unpack `proxypress-bin-aur.tar.gz` and run `makepkg -si`)

---

### What's New in v1.0.1

- **Brand & Icon Redesign:**
  - Replaced the placeholder logo with a brand new vector app emblem depicting layered Magic cards with gold foil borders, an art window mana spark, and precision print-and-cut registration marks.
  - Updated multi-resolution Windows `.ico` and Linux `.png` desktop application icons.
- **UI & Accessibility Polish:**
  - Fixed low-contrast warning callouts: dark amber theme with high-contrast text and prominent gold-trimmed action buttons.
  - Smooth, lightweight UI transitions: fluid step-by-step welcome tour animations, modal ease-in, tactile button press feedback, smooth sidebar tab switching, and floating toast notices.
- **Desktop App Enhancements:**
  - Seamless dark window launch with zero white screen flashing (`backgroundColor: '#14161a'` and deferred paint show).
  - Clean auto-hiding menu bar (tap `Alt` to access) for a distraction-free desktop experience.
  - Windows taskbar icon grouping (`setAppUserModelId`).
- **Packaging & Builds:**
  - Fixed RPM package generation for modern rpmbuild (Fedora, openSUSE, RHEL).
  - Fixed Docker container build asset whitelisting.

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
