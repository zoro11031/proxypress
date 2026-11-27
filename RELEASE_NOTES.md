# Proxy Press v0.10.3

- Fixed the duplex alignment calculator for 2-point diagonal and 3-point collinear readings, added leave-one-out + Tukey IRLS outlier isolation, and guarded against singular matrices and extreme typos.
- Hardened the duplex scan reader: downscaled oversized high-DPI scans, cut connected-component RAM by 4×, indexed quad detection into an O(N) spatial grid, adapted thresholds for dim/matte scans, and added undo for resetting back alignment.
- Fixed shared artwork storage failures in read-only containers (`PRAGMA temp_store=MEMORY` and safe WAL fallback), rounded millimeter trim/sheet labels (`62.99 × 87.97 mm`), and deduplicated share-error toasts.
- Improved UI usability and accessibility: single primary action on empty decks, instant Undo for card removal and clearing a deck, pause-on-hover toasts, full keyboard navigation on the deck menu and duplex flip choices, and consistent `Backups & data` labeling.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.10.3/Proxy-Press-0.10.3.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.10.3/Proxy-Press-0.10.3.msi).

**Linux x86_64:** [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.10.3/Proxy-Press-0.10.3.AppImage), [Debian or Ubuntu](https://github.com/zoro11031/proxypress/releases/download/v0.10.3/Proxy-Press-0.10.3.deb), [Fedora or openSUSE](https://github.com/zoro11031/proxypress/releases/download/v0.10.3/Proxy-Press-0.10.3.rpm), [Arch or CachyOS](https://github.com/zoro11031/proxypress/releases/download/v0.10.3/Proxy-Press-0.10.3.pacman), or [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.10.3/proxypress-bin-aur.tar.gz).
