# Proxy Press v0.10.2

- Hardened the Python server and Electron desktop relay: one-time SQLite WAL initialization, background disk cache pruning, atomic Electron cache writes, Scryfall rate limiting and collection caching, symlink-safe asset resolution, magic-byte upload validation, and `/healthz` container health checks.
- Fixed frontend memory and state edge cases: revoked blob URLs on deck clear/delete/replacement, serialized Scryfall requests with timeouts, clamped parsed card quantities, guarded `busy()` states with `try/finally`, and fixed cardback/orphan image cleanup.
- Polished UI and accessibility: raised toasts above mobile navigation, lowered dropdown menus below modals, removed duplicate confirmation cancel buttons, unified art-fill copy, and synced ARIA state on proof and settings controls.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.10.2/Proxy-Press-0.10.2.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.10.2/Proxy-Press-0.10.2.msi).

**Linux x86_64:** [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.10.2/Proxy-Press-0.10.2.AppImage), [Debian or Ubuntu](https://github.com/zoro11031/proxypress/releases/download/v0.10.2/Proxy-Press-0.10.2.deb), [Fedora or openSUSE](https://github.com/zoro11031/proxypress/releases/download/v0.10.2/Proxy-Press-0.10.2.rpm), [Arch or CachyOS](https://github.com/zoro11031/proxypress/releases/download/v0.10.2/Proxy-Press-0.10.2.pacman), or [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.10.2/proxypress-bin-aur.tar.gz).
