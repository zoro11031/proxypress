# Proxy Press v1.0.3

A refreshed workspace, suggestions for your deck, clearer exports, and better token handling. Letter and A4 portrait/landscape presets are still one click away.

## What's new

- Refreshed dark interface with clearer navigation, grouped import controls, a larger preview, and better phone layouts.
- Paper size and orientation shortcuts beside the preview, a hide-sidebar option, and a Fit button that fits the whole sheet.
- Suggestions based on cards already in your deck, using EDHREC data. Add a card with **+** or browse card previews with **Explore suggestions**.
- Right-click **Change card match…** to correct the Scryfall card or printing while optionally keeping your chosen artwork.
- **Choose token faces…** lets you use either token face alone or both sides of a printed pairing. Chosen token artwork is saved with the deck.
- Treasure imports now select Treasure rather than the Dinosaur face of Dinosaur // Treasure. Different faces of the same printing keep their own quantities, and automatic token art selection rejects mismatched token names.
- Thin corner brackets, full outlines, guide colors, placement, and line styles. Preview and PDF use the same guide geometry.
- **Share deck with art & layout** is a visible export option in both Print and Order modes. The file includes artwork and layout while preserving the recipient's printer alignment.

## Fixes

- Desktop Scryfall lookups and searches retain their query parameters.
- Desktop Archidekt imports exclude cards outside the deck and retain the deck name.
- Keyboard art selection fires once per keypress; deck thumbnails also support keyboard activation.
- Export buttons consistently reflect whether cards are available.
- Desktop relays enforce allowed endpoints, size limits, and timeouts. Navigation checks the exact app origin, including reopened windows.
- Release versions and download filenames are checked before packaging. A release is published after all expected downloads have uploaded.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v1.0.3/Proxy-Press-1.0.3.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v1.0.3/Proxy-Press-1.0.3.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v1.0.3/Proxy-Press-1.0.3.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v1.0.3/Proxy-Press-1.0.3.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v1.0.3/Proxy-Press-1.0.3.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v1.0.3/Proxy-Press-1.0.3.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v1.0.3/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

## Thanks

Thanks to [MPC Autofill](https://mpcfill.com) and its community drives, [Scryfall](https://scryfall.com), [EDHREC](https://edhrec.com), [Proxxied](https://proxxied.com), [ProxyJak](https://proxyjak.com), and the artists and toolmakers supporting proxy printing. Consider [supporting the autofill service on Patreon](https://www.patreon.com/mpcfill).

Proxy Press code is licensed under [GPL-3.0-or-later](https://github.com/zoro11031/proxypress/blob/main/LICENSE). Card artwork, frames, and fonts belong to their respective owners.
