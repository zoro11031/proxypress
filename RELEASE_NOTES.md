# Unreleased

- Share decks through public, revocable links with original artwork stored once on the server. Set `PUBLIC_URL` for your domain; storage defaults to 1 GB per deck and 20 GB total.
- Export compact JSON with artwork at up to 600 DPI and references to server originals. Imports restore originals when available and work offline with embedded images. Mobile exports offer a Save file step after packing.
- Preserve Outside trim across reloads and keep crop ticks within the available space between cards and at paper edges.

# Proxy Press v1.0.7

Fix cut guides and outlines strictly under card faces with only corner cuts over, and restore functional corner shape and placement controls.

## What's new

- **Strict layer separation:** Black sheet cut lines, margin lines, and card outlines are strictly rendered underneath card faces (`underLines`). Only corner marks/cuts are rendered on top (`overLines`), ensuring no cut lines or bounding boxes cross over card artwork.
- **Working corner shape selector:** Restored functionality to the Corner Shape dropdown (L brackets vs. Crop ticks with clean offset gap). Toggling cut guide presets no longer resets the selected shape.
- **Working corner placement selector:** Restored functionality to the Corner Placement dropdown (Inside trim on card corners vs. Outside trim into bleed/margins).
- **Default inside placement:** Set default corner bracket placement to Inside trim (matching Proxxied layout) with automatic migration of existing user profiles.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v1.0.7/Proxy-Press-1.0.7.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v1.0.7/Proxy-Press-1.0.7.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v1.0.7/Proxy-Press-1.0.7.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v1.0.7/Proxy-Press-1.0.7.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v1.0.7/Proxy-Press-1.0.7.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v1.0.7/Proxy-Press-1.0.7.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v1.0.7/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

## Thanks

Thanks to [MPC Autofill](https://mpcfill.com) and its community drives, [Scryfall](https://scryfall.com), [EDHREC](https://edhrec.com), [Proxxied](https://proxxied.com), [ProxyJak](https://proxyjak.com), and the artists and toolmakers supporting proxy printing. Consider [supporting the autofill service on Patreon](https://www.patreon.com/mpcfill).

Proxy Press code is licensed under [GPL-3.0-or-later](https://github.com/zoro11031/proxypress/blob/main/LICENSE). Card artwork, frames, and fonts belong to their respective owners.
