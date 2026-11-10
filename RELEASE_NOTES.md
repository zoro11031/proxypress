# Proxy Press v1.0.6

Cut guide line thickness matched to Proxxied standard (0.25 mm / 0.72 pt), crisp and consistent outline rendering, and colorblind-friendly default palette.

## What's new

- **Proxxied-matched cut guide thickness:** Default guide line width is now 0.25 mm (0.72 pt), perfectly matching Proxxied print outputs for both corner marks and full cut lines.
- **Crisp, consistent outlines:** Card trim outlines now render cleanly over card bleed in both previews and exported PDFs, ensuring 100% consistent line width without bleed clipping.
- **Colorblind-friendly guide palette:** Default corner guide color is now vibrant cyan/sky blue (`#00bfff`), providing universal contrast against card artwork across all forms of color vision (including red-green deuteranopia and protanopia).
- **Quick-pick colorblind swatches:** Guide appearance settings now feature colorblind-safe swatches (Sky Blue, High-contrast Yellow, White, Black, Gray).
- **Automatic settings migration:** Existing user profiles with previous defaults (0.15 mm or lime green) are smoothly updated on load.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v1.0.6/Proxy-Press-1.0.6.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v1.0.6/Proxy-Press-1.0.6.msi).

**Linux x86_64:**

- [AppImage](https://github.com/zoro11031/proxypress/releases/download/v1.0.6/Proxy-Press-1.0.6.AppImage) — make executable and launch.
- [Debian / Ubuntu (.deb)](https://github.com/zoro11031/proxypress/releases/download/v1.0.6/Proxy-Press-1.0.6.deb).
- [Fedora / openSUSE (.rpm)](https://github.com/zoro11031/proxypress/releases/download/v1.0.6/Proxy-Press-1.0.6.rpm).
- [Arch / CachyOS / Manjaro (.pacman)](https://github.com/zoro11031/proxypress/releases/download/v1.0.6/Proxy-Press-1.0.6.pacman).
- [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v1.0.6/proxypress-bin-aur.tar.gz) — unpack and run `makepkg -si`.

Desktop downloads include fonts and frames and require no login. For a home server, use `docker compose up -d --build` from the updated checkout.

## Thanks

Thanks to [MPC Autofill](https://mpcfill.com) and its community drives, [Scryfall](https://scryfall.com), [EDHREC](https://edhrec.com), [Proxxied](https://proxxied.com), [ProxyJak](https://proxyjak.com), and the artists and toolmakers supporting proxy printing. Consider [supporting the autofill service on Patreon](https://www.patreon.com/mpcfill).

Proxy Press code is licensed under [GPL-3.0-or-later](https://github.com/zoro11031/proxypress/blob/main/LICENSE). Card artwork, frames, and fonts belong to their respective owners.
