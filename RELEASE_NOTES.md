# Proxy Press v1.0.8

Search Scryfall printings, share decks via public links, match uploads across the instance, and export compact JSON bundles with original artwork.

## What's new

- **Scryfall art search:** Art search includes Scryfall printings alongside community art and shared uploads. Sources load independently, official choices are cached locally, and front/back selections keep the correct face.
- **Instance art sharing:** Uploaded artwork can be matched to a card or skipped. Matched uploads appear in this server's art search, with thumbnails and full originals; duplicates are stored once and saved decks keep independent copies.
- **Public deck sharing:** Share decks through public, revocable links with original artwork stored once on the server. Set `PUBLIC_URL` for your domain; storage defaults to 1 GB per deck and 20 GB total.
- **Compact JSON export:** Export compact JSON with artwork at up to 600 DPI and references to server originals. Imports restore originals when available and work offline with embedded images. Mobile exports offer a Save file step after packing.
- **Outside trim stability:** Preserve Outside trim across reloads and keep crop ticks within the available space between cards and at paper edges.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v1.0.8/Proxy-Press-1.0.8.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v1.0.8/Proxy-Press-1.0.8.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v1.0.8/Proxy-Press-1.0.8.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v1.0.8/Proxy-Press-1.0.8.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v1.0.8/Proxy-Press-1.0.8.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v1.0.8/Proxy-Press-1.0.8.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v1.0.8/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

## Thanks

Thanks to [MPC Autofill](https://mpcfill.com) and its community drives, [Scryfall](https://scryfall.com), [EDHREC](https://edhrec.com), [Proxxied](https://proxxied.com), [ProxyJak](https://proxyjak.com), and the artists and toolmakers supporting proxy printing. Consider [supporting the autofill service on Patreon](https://www.patreon.com/mpcfill).

Proxy Press code is licensed under [GPL-3.0-or-later](https://github.com/zoro11031/proxypress/blob/main/LICENSE). Card artwork, frames, and fonts belong to their respective owners.
