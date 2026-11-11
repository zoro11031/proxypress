# Proxy Press v0.5.1

Resolution metadata for official Scryfall card imagery in art search.

## What's new

- **Scryfall art DPI:** Scryfall card printings in art search now display their resolution (300 DPI) alongside set code and collector number, matching community art metadata formatting and respecting high-DPI threshold highlighting.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.1/Proxy-Press-0.5.1.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.1/Proxy-Press-0.5.1.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.1/Proxy-Press-0.5.1.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.1/Proxy-Press-0.5.1.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.1/Proxy-Press-0.5.1.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.1/Proxy-Press-0.5.1.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.1/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Previous Releases

### v0.5.0
- **HTTP caching & 304 Not Modified:** Added ETags and conditional request handling across the application page, static assets, symbols, instance art, and API relays.
- **Pre-rendered page cache:** In-memory caching of the HTML document and script CSP hashes to eliminate disk reads and regex hashing on warm loads.
- **Bundled asset manifest:** Embedded frame styles into the manifest to eliminate 18 individual HTTP roundtrips on startup.
- **Client-side persistent caching:** Cached frame sets, fonts, symbol maps, and art search metadata in IndexedDB.
- **Staple card pre-caching:** Background pre-caching for basic lands and common format staples to accelerate deck imports.
- **UI render optimizations:** Synchronous thumbnail rendering in the card list and memoized cut guide calculations.

### v0.4.0
- **Public deck sharing:** Share decks via public, revocable links with deduplicated server storage.
- **Instance art library:** Uploaded artwork matched to cards is indexed and searchable across the instance.
- **Scryfall art search:** Browse and select official Scryfall printings alongside community art.
- **Compact JSON export:** Export decks with compressed artwork and links to original server assets.

### v0.3.3
- **Layer ordering:** Sheet cut lines and outlines render strictly under cards; only corner marks render on top.
- **Dropdown controls:** Restored corner shape and placement selector options.

### v0.3.2
- **Guide specs:** Proxxied 0.25 mm line thickness and colorblind-safe guide palettes.

### v0.3.1
- **Layered guides:** Combination guide toggle and All preset.

### v0.3.0
- **Cut guides:** Continuous sheet lines, custom cut/corner colors, and dark workspace.

### v0.2.0
- **Deck suggestions:** EDHREC suggestions for Commander and constructed decks.
- **Token faces:** Support for selecting specific faces on tokens and double-faced cards.

### v0.1.2
- **Workflow fixes:** Tour navigation, deck import boards, and export button fixes.

### v0.1.1
- **Polish:** Brand icon redesign, dark warning styles, and window bounds fixes.

### v0.1.0
- **Initial release:** Desktop application packaging for Windows (.exe/.msi) and Linux (.AppImage, .deb, .rpm, .pacman, AUR).

## Thanks

Thanks to [MPC Autofill](https://mpcfill.com) and its community drives, [Scryfall](https://scryfall.com), [EDHREC](https://edhrec.com), [Proxxied](https://proxxied.com), [ProxyJak](https://proxyjak.com), and the artists and toolmakers supporting proxy printing. Consider [supporting the autofill service on Patreon](https://www.patreon.com/mpcfill).

Proxy Press code is licensed under [GPL-3.0-or-later](https://github.com/zoro11031/proxypress/blob/main/LICENSE). Card artwork, frames, and fonts belong to their respective owners.
