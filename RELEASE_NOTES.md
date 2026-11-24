# Proxy Press v0.10.0

A new workspace, Silhouette Card Maker output that matches Card Maker's own, and a double-sided test that measures the back's angle and size as well as its offset.

- **Workspace:** the sheet lies on a cutting mat with millimetre rulers, the card list reads like a decklist, and the print summary shows every setting in one place. Anything Proxy Press changes for you, such as making a job double-sided for a double-faced card, stays highlighted until you accept it. Short questions use in-app dialogs instead of browser pop-ups.
- **Silhouette Card Maker:** card positions, bleed, registration marks and the sheet label now match Card Maker's `create_pdf.py` on all 190 of its templates, including the single-row and single-column ones.
- **Registration test page:** a one-page PDF with the registration marks and a faint outline of every card position, a solid line at the bleed edge and a dashed line at the safe area. Cut it on scrap paper: if the cuts are centred, each one falls between the two lines. The outlines are pure black, so a color laser prints them from black toner alone.
- **Double-sided test:** prints your real layout on both sides with five pin points on every card and a 1 mm grid behind each. Enter as many readings as you like, or scan page 2 against black paper and Proxy Press reads every hole. It works out the back's offset, angle and size, reports any skew no setting can fix, and never changes the front. No light box: it works on black-core card. A scan reads a back up to about 8 mm off in one pass. On Card Maker templates it shows the same correction as `offset_pdf.py` values and takes Card Maker's saved `offset_data.json`.
- **Artwork:** Change art opens on Community art, with Scryfall printings and your own files a tab away.
- **Fixes:** cards from your own images no longer show a stray "#", and the card list's counts and layout summary are easier to read.

## Downloads

**Windows x64:** [Installer (.exe)](https://github.com/zoro11031/proxypress/releases/download/v0.10.0/Proxy-Press-0.10.0.exe) or [MSI](https://github.com/zoro11031/proxypress/releases/download/v0.10.0/Proxy-Press-0.10.0.msi).

**Linux x86_64:** [AppImage](https://github.com/zoro11031/proxypress/releases/download/v0.10.0/Proxy-Press-0.10.0.AppImage), [Debian or Ubuntu](https://github.com/zoro11031/proxypress/releases/download/v0.10.0/Proxy-Press-0.10.0.deb), [Fedora or openSUSE](https://github.com/zoro11031/proxypress/releases/download/v0.10.0/Proxy-Press-0.10.0.rpm), [Arch or CachyOS](https://github.com/zoro11031/proxypress/releases/download/v0.10.0/Proxy-Press-0.10.0.pacman), or [AUR build files](https://github.com/zoro11031/proxypress/releases/download/v0.10.0/proxypress-bin-aur.tar.gz).
