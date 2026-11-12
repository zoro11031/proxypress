# Proxy Press v0.5.4

Duplex printing and uploaded-image bleed calibration improvements.

## What's new

- **Long-edge and short-edge duplex printing:** Back pages now follow the selected binding edge in both preview and exported PDFs.
- **Duplex calibration wizard:** Print a two-sided alignment test, identify the correct binding direction, and save backside X/Y correction.
- **MPC image bleed:** Uploaded-image bleed defaults to 3.048 mm (0.12 in), matching the bleed already included in standard card images.
- **Binding visuals:** The duplex wizard includes diagrams for long-side and short-side binding.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4/Proxy-Press-0.5.4.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.4/Proxy-Press-0.5.4.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.4/Proxy-Press-0.5.4.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4/Proxy-Press-0.5.4.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4/Proxy-Press-0.5.4.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4/Proxy-Press-0.5.4.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.4/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Previous Releases

### v0.5.3

Automatic corner guide contrast against card borders and artwork, and smooth deck import warning animations.

## What's new

- **Automatic corner guide contrast:** Corner cut marks now automatically adapt their color to contrast against each card's border color or sampled corner artwork (e.g. black corner guides on white-bordered cards like Revised/4th Edition or bright borderless art, and bright cyan corner guides on dark/black-bordered cards), ensuring cut guides never blend into card edges. Manual per-card corner color overrides continue to be respected.
- **Deck import warning animations:** The missing card alert banner and Scryfall spelling suggestions now animate smoothly into view with subtle downward motion, micro-scale, and an amber accent bloom, providing polished visual feedback during deck imports.
- **Cut guide cache precision:** Guide lines caching now incorporates corner mark shape, length, and style settings alongside per-card colors for instant, artifact-free updates across layout changes.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.3/Proxy-Press-0.5.3.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.3/Proxy-Press-0.5.3.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.3/Proxy-Press-0.5.3.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.3/Proxy-Press-0.5.3.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.3/Proxy-Press-0.5.3.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.3/Proxy-Press-0.5.3.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.3/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

### v0.5.2
- **Deck import spelling suggestions:** When imported cards cannot be found, Proxy Press searches Scryfall with fuzzy matching and autocomplete to suggest likely card names, with one-click **Use** (updates the import box) and **Add** (adds directly to deck).
- **Per-card corner guide colors:** Override the corner bracket color for individual cards (via right-click or the `⋯` card menu) so guide marks never blend into card artwork. Persists in deck saves and prints in exported PDFs.
- **Contrasting guide outline:** Upgraded the guide outline halo from a fixed white border to an automatic contrast calculation based on line luminance (dark halo for bright guides like cyan, yellow, or white; white halo for dark guides like black or slate).
- **Full outline guidance:** Clarified the Full outline guide preset tooltip for hand-cutting cards when sheet-spanning cut lines are toggled off.

### v0.5.1
- **Scryfall art DPI:** Scryfall card printings in art search now display their resolution (300 DPI) alongside set code and collector number, matching community art metadata formatting and respecting high-DPI threshold highlighting.

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
