# Proxy Press v1.0.0

A browser-based MTG proxy maker. Drop in a decklist, pick your art, and get a print-ready PDF with proper bleed and cut lines—or an order file ready for MakePlayingCards.

---

### What's New in v1.0.0

- **Standalone Desktop App (Windows & Linux):**
  - Runs 100% locally on your machine with zero configuration.
  - **No password required by default**—designed for personal home use without login friction.
  - Built-in embedded relay for Scryfall card data, symbology vectors, and MPC Autofill search.
- **Bundled Fonts & Frame Packs:**
  - Includes 24 authentic MTG card typography fonts (Beleren, Plantin, Matrix, Medieval, etc.).
  - Includes 18 Magic Set Editor frame packs (M15, Planeswalker, 8th Edition, Retro, Borderless, Vintage).
- **Multi-Format Linux Packaging:**
  - Universal portable `.AppImage`
  - Debian & Ubuntu `.deb` package
  - Fedora, openSUSE & RHEL `.rpm` package
  - Arch Linux standalone `.pacman` package
  - Arch packaging files (`aur/PKGBUILD` and `proxypress-bin-aur.tar.gz`)
- **Print at Home Workflow:**
  - Configurable page margins, trim guides, bleed guides, and double-sided alignment calibration.
  - Silhouette Cameo registration marks and cut file generation.
- **Order Prints Workflow:**
  - Cardstock selection (S33 Superior Smooth, S30 Standard Smooth, M31 Linen, P10 Plastic).
  - One-click `.zip` bundle export containing your formatted order file and card images.

---

### 📦 Installation

#### Windows
- **Installer:** Download and run `Proxy-Press-1.0.0.exe` (or `Proxy-Press-1.0.0.msi`).

#### Linux
- **AppImage (Universal / Portable):**
  ```sh
  chmod +x Proxy-Press-1.0.0.AppImage
  ./Proxy-Press-1.0.0.AppImage
  ```
- **Debian / Ubuntu (.deb):**
  ```sh
  sudo apt install ./Proxy-Press-1.0.0.deb
  ```
- **Fedora / RHEL (.rpm):**
  ```sh
  sudo dnf install ./Proxy-Press-1.0.0.rpm
  ```
- **openSUSE (.rpm):**
  ```sh
  sudo zypper install ./Proxy-Press-1.0.0.rpm
  ```
- **Arch Linux / CachyOS / Manjaro:**
  - Direct pacman install:
    ```sh
    sudo pacman -U Proxy-Press-1.0.0.pacman
    ```
  - Arch build files (PKGBUILD):
    Download `proxypress-bin-aur.tar.gz` from the release assets, unpack, and run:
    ```sh
    tar -xvf proxypress-bin-aur.tar.gz
    makepkg -si
    ```

---

### ❤️ Special Thanks & Supporting MPC Autofill

Huge thanks to **[MPC Autofill / MPCFill](https://mpcfill.com)** above all. None of this would exist without their community drives, card scans, and high-DPI renders.

If you use the autofill tool or community drives, please consider **[supporting their server and maintenance costs on Patreon](https://www.patreon.com/mpcfill)**.

Special thanks also to:
- **[ProxyJak](https://proxyjak.com)** — For quality proxy cardstock.
- **[Cry Cry](https://www.youtube.com/@crycryproxy)** — Essential YouTube tutorials on paper stocks, foiling, and cutter calibration.
- **[Scryfall](https://scryfall.com)** — The card data API powering the MTG community.
- **[Proxxied](https://proxxied.com)** — Sheet layout and in-browser preview inspiration.
- **Magic Set Editor & Card Conjurer / MTG.Design** — Card framing and typography foundations.

---

### ⚖️ Fair Use Notice
Code is free software under [GPL-3.0-or-later](LICENSE). Card frames, symbol vectors, and fonts bundled in `assets/` are proprietary trademarks/copyrights of their respective owners and are bundled in accordance with fair use for non-commercial, personal card crafting and proxy printing.
