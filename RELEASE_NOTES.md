# Proxy Press v0.5.12

A double-sided test that can be measured from a scan, and a back-page scale that no longer fights the front.

## What's new

- **Back-page scale rides on the front scale instead of replacing it.** The field says 100% leaves the calibrated size unchanged; it did not. Back pages used the back scale *in place of* the front one, so the moment you calibrated the front size off 100%, every back page printed at a different size from its front — 0.3% is 0.8 mm across a Letter sheet, and nothing in the double-sided test would have told you where it came from. It is now a true delta, and settings saved before this keep the size they had.
- **The double-sided test can be measured instead of eyeballed.** All four corner marks now have a clear middle and a ring to pierce inside, on both pages. Pierce all four, scan both sides, and four holes against four marks give the shift, the turn and the size in one reading — where a single hole in the middle can only ever give a shift, so a turned or slightly resized back page reads as a shift and gets corrected as one.
- **The hole no longer has to be pierced accurately.** Measured against its own side's mark in each of the two scans, its position cancels exactly. A first real scan had the holes 0.3 to 0.5 mm off centre, which went straight into the answer; now it does not matter where inside the ring the pin goes.
- **Both pages carry a scan key and the settings they were made with** — the printed position of every mark, the flip, the scales and the offsets — so a scan of either side stands on its own.
- **Alignment sheet corrections.** Labels on the corner scales named the tick 1.4 mm away from them; the printed degrees-per-millimetre was reckoned between the corner crosses rather than the scales you sight against, making every angle 6.6% small; the 5 mm label straddled the 5 mm a printer cannot reach; and "a missing line means your margin is wider than 6 mm" was untrue at scales the sheet's own table offers.
- **The 310 gsm calibration starting point is withdrawn.** A back-page offset belongs to one flip: the same machine and stock measured X +1.5 mm on a short-edge flip and −1.8 mm on a long-edge one.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.12/Proxy-Press-0.5.12.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.12/Proxy-Press-0.5.12.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.12/Proxy-Press-0.5.12.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.12/Proxy-Press-0.5.12.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.12/Proxy-Press-0.5.12.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.12/Proxy-Press-0.5.12.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.12/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Proxy Press v0.5.11

A double-sided test that can be measured, and an alignment sheet that reads what it says it reads.

## What's new

- **The double-sided test now carries four readable corners, not one.** One pin hole against one grid in the middle of the page can only tell you a shift. A back page that is turned, or printing a fraction of a percent large, reads as a shift too, gets corrected as one, and never quite comes right. Page 1 puts an aiming ring and a centre dot inside each of the four corner marks; page 2 keeps the middle of its corner marks clear so a hole landing there is the only dark thing inside the ring. Four holes against four marks separate the shift, the turn and the size.
- **One scan of the back carries both sides.** A hole is the front page seen through the paper, so the back alone holds everything. Page 2 prints a SCAN KEY stating, in its own millimetres, where the marks were printed and where the holes belong if the two sides register — everything a reader of the scan needs that the scan itself cannot show. One corner mark carries a solid dot: four marks on a rectangle look the same upside down, and that one does not.
- **The squareness gauge reads what it says it reads.** Labels on the scales nearest the bottom and right edges named the tick 1.4 mm away from them. The printed degrees-per-millimetre was reckoned between the corner crosses while the scales you sight against sit 16 mm closer together, so every angle read off the sheet came out 6.6% small. The label for 5 mm straddled the 5 mm a printer cannot reach. And "a missing line means your margin is wider than 6 mm" was untrue above about 100.75% horizontal scale — a value the sheet's own table offers — because by then the line itself has moved. All four corrected; the sheet now prints where the four lines actually fall, and the blank-sheet diagonal figure follows the paper size instead of assuming Letter.
- **The 310 gsm calibration starting point is withdrawn.** A back-page offset belongs to one flip. The flip decides which axis the back page is mirrored in and sends the sheet back through on a different edge, so the second pass is a different mechanical event: the same machine and stock measured X +1.5 mm on a short-edge flip and -1.8 mm on a long-edge one. Two readings on two flips do not confirm each other. The any-paper entry stays.
- **Page margin says what it does.** The field takes tenths of a millimetre and always did, but the cards are centred, so the real margin is the space left over and is usually wider than the minimum you type. Nothing moves until the figure crosses the point where a column or row stops fitting.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.11/Proxy-Press-0.5.11.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.11/Proxy-Press-0.5.11.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.11/Proxy-Press-0.5.11.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.11/Proxy-Press-0.5.11.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.11/Proxy-Press-0.5.11.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.11/Proxy-Press-0.5.11.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.11/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Proxy Press v0.5.10

Calibration profiles you can read and edit.

## What's new

- **The profile name box is legible:** it was rendering light grey text on white, so whatever you typed was invisible until you selected it. One missing attribute; it was the only field in the app that had it.
- **Profiles can be edited:** picking a saved profile now puts its name in the box, and saving over it renames that profile in place instead of leaving the old name behind as a second copy. Deleting clears the box, and a built-in starting point's name can no longer be taken, which used to be the way to end up with two entries called the same thing.
- **Page margin says what it does:** the field takes tenths of a millimetre and always did, but the cards are centred on the sheet, so the real margin is the space left over and is usually wider than the minimum you type. Nothing moves until the figure crosses the point where a column or row stops fitting. The field now says so.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.10/Proxy-Press-0.5.10.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.10/Proxy-Press-0.5.10.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.10/Proxy-Press-0.5.10.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.10/Proxy-Press-0.5.10.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.10/Proxy-Press-0.5.10.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.10/Proxy-Press-0.5.10.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.10/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Proxy Press v0.5.9

Double-sided test fixed for long-edge flipping, and a squareness gauge on the alignment sheet.

## What's new

- **Double-sided test matches the cards on a long-edge flip:** on a flip that mirrors top to bottom — landscape with long edge, portrait with short edge — the printer lays the back down head to foot. Card faces were already turned to suit; the test sheet was not, so its page 2 printed the right way up while every card around it was inverted. Page 2 now turns with the flip, exactly as the card faces do.
- **The reading sign turns with it:** because the test sheet's grid turns too, its axes run the other way, so the wizard and the sheet's own arithmetic now subtract the reading instead of adding it on those flips. Adding it would have doubled the error rather than cancelled it.
- **Squareness gauge on the alignment sheet:** a line near each edge turns a rotated print into a tapering white margin you can see at a glance, and a graduated scale at each corner gives a rule something exact to sight against. The sheet prints the conversion from a corner-to-corner difference to an angle, plus the blank-sheet diagonal check that tells a crooked feed from paper cut off square.
- **Measured calibration starting points:** the printer calibration profile list now opens with offsets measured on a Canon imageCLASS MF753Cdw II at a short-edge flip — one for any paper, one for ProxyJak 310gsm. They are starting points, not a substitute for printing the test.
- **Clearer manual re-feed steps:** the sheet turn is described once rather than three times in three different vocabularies.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.9/Proxy-Press-0.5.9.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.9/Proxy-Press-0.5.9.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.9/Proxy-Press-0.5.9.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.9/Proxy-Press-0.5.9.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.9/Proxy-Press-0.5.9.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.9/Proxy-Press-0.5.9.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.9/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Proxy Press v0.5.7

Reference-style duplex wizard diagrams.

## What's new

- **Turn-sheet illustrations:** Feed diagrams now show skewed paper sheets, shadows, folded corners, and curved arrows to make the physical refeed motion clearer.
- **Feed-edge emphasis:** Yellow leading-edge markers and the selected binding badge make the intended feed direction easier to identify.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.7/Proxy-Press-0.5.7.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.7/Proxy-Press-0.5.7.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.7/Proxy-Press-0.5.7.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.7/Proxy-Press-0.5.7.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.7/Proxy-Press-0.5.7.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.7/Proxy-Press-0.5.7.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.7/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Proxy Press v0.5.6

Duplex calibration wizard readability improvements.

## What's new

- **Larger calibration wizard:** The popup now uses more available screen space.
- **Readable feed diagrams:** Long-/short-side binding examples are shown in full-width rows with larger labels and clearer edge markings.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.6/Proxy-Press-0.5.6.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.6/Proxy-Press-0.5.6.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.6/Proxy-Press-0.5.6.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.6/Proxy-Press-0.5.6.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.6/Proxy-Press-0.5.6.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.6/Proxy-Press-0.5.6.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.6/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Proxy Press v0.5.5

Duplex calibration helper and physical feed-orientation improvements.

## What's new

- **Duplex alignment calibration PDF:** Two-page paper-sized calibration sheets with targets, rulers, signed X/Y measurement guidance, and long-/short-edge orientation.
- **Back-page compensation:** Apply back-only X/Y offsets and fine X/Y scale corrections without changing front-page coordinates.
- **Calibration profiles:** Save named printer calibration settings locally and restore them when switching printers.
- **Physical feed diagrams:** Show landscape and portrait examples with every paper edge labeled and the exact leading edge highlighted.
- **MPC bleed handling:** Standard MPC artwork uses its built-in 3.048 mm bleed by default.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.5/Proxy-Press-0.5.5.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.5/Proxy-Press-0.5.5.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.5/Proxy-Press-0.5.5.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.5/Proxy-Press-0.5.5.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.5/Proxy-Press-0.5.5.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.5/Proxy-Press-0.5.5.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.5/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Proxy Press v0.5.4.1

Duplex feed-direction and offset measurement refinements.

## What's new

- **Explicit re-feed direction:** The duplex wizard asks which edge entered first and identifies the exact edge to feed for the back page.
- **Offset measurement rulers:** The double-sided test now includes 1 mm X/Y rulers and signed displacement guidance.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4.1/Proxy-Press-0.5.4.1.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.5.4.1/Proxy-Press-0.5.4.1.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.5.4.1/Proxy-Press-0.5.4.1.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4.1/Proxy-Press-0.5.4.1.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4.1/Proxy-Press-0.5.4.1.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v0.5.4.1/Proxy-Press-0.5.4.1.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.5.4.1/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

---

# Previous Releases

### v0.5.4

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
