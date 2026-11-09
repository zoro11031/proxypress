# AGENTS.md

Proxy Press is a single-page MTG proxy maker. It imports decklists, finds art on Scryfall and MPC Autofill, makes custom cards and exports print-ready PDFs or MakePlayingCards order files. See `README.md` for what users see.

## Layout

| File | What it is |
|---|---|
| `proxy-press.html` | The whole app: HTML, CSS and one inline `<script>`. No build step, no framework, no npm. |
| `proxy-press-server.py` | Python standard-library server. Serves the page, login, relays (`/mpc/`, `/sf/`, `/deck`, `/sym/`), `/assets/` and the disk cache. No dependencies. |
| `Dockerfile`, `compose.yaml` | Container image. Read-only root, `cap_drop: ALL`, non-root user, `cache` named volume at `/app/cache`. |
| `.github/workflows/image.yml` | Pushes to `main` build `ghcr.io/<owner>/proxypress`. |
| `assets/` | Fonts and frame packs (`fonts/`, `frames/<set>/`). Not in git; mounted read-only. |
| `cache/` | Server cache plus `session.key`. Not in git. |

The page is split into sections marked `/* ---------- name ---------- */` (storage, layout, Scryfall, MPC Autofill, custom card maker, settings form, preview, PDF export, …). Find code by grepping for those or for function names; the file is too large to read whole.

Key places in `proxy-press.html`:
- `DEFAULTS`, `BUILTIN_PRESETS`, `PRINTERS`: print settings, presets and printer profiles.
- `FIELDS` and `cleanSettings`/`cleanDeck`: the settings form, and validation of saved and imported data. A new setting needs a `DEFAULTS` entry, and a select needs its options in `FIELDS`, or `cleanSettings` drops it.
- `layout`, `slotPos`, `guideLines`, `exportPDF`: sheet layout, cut guides and PDF output (jsPDF). The preview SVG and the PDF draw the same guide data, so change both.
- `sf`, `parseList`, `importList`: Scryfall access (through `/sf/` with a direct fallback) and decklist parsing (plain, Moxfield, Archidekt).
- `ERA_TYPE`, `fromScryfall`, `renderCustomCard`: the card maker. Typography is tuned against real prints per frame era.

## Running

```sh
python3 proxy-press-server.py            # http://localhost:8642
PASSWORD=test NO_BROWSER=1 python3 proxy-press-server.py 8650
docker compose up -d --build             # or podman
```

Without `assets/` the card maker has no frames or fonts. Point `ASSETS=` at a frame pack to test it.

## Checks

There is no linter, formatter, pre-commit hook or test suite in the repo. Before committing:
- `python3 -m py_compile proxy-press-server.py`
- `node tools/console-check.js` — starts a server, loads the page in headless chromium and reports console errors and CSP violations. Needs node 22+ and chromium; no npm packages. Add `--probe tools/duplex-probe.js` to also assert behaviour inside the page. Exit 0 clean, 1 findings, 2 inconclusive.
- Or load the page in a browser by hand and check the console. The strict CSP turns mistakes into silent failures, so look for CSP violations too.
- For layout, guides or export changes, export a PDF and look at it rasterised. For card-maker changes, compare the render against the real Scryfall card image for the same printing.

Three things about checking the console that cost real time to learn, and that the
tool exists to encode:

- **CSP violations never reach `console`.** They arrive on the CDP `Log.entryAdded`
  channel with source `security`, and they lag the action that caused them by up to
  2.5 seconds. Anything that watches only console output, or stops listening early,
  reports a clean page while the CSP is quietly blocking things.
- **A clean result means nothing on its own.** A listener that is broken and a page
  that is fine produce identical output, and proving the listener in a separate run
  does not transfer. The tool forces one violation per channel in the same run it
  collects, matched on a marker unique to that probe, and refuses to say "clean"
  unless every one comes back caught.
- **An injected check passes whatever page is loaded.** If sign-in fails the server
  serves the login form, which has no app script and so produces no violations at
  all, and everything still comes back green. The tool checks separately that the app
  is actually there, and treats its absence as outranking every other result.

## Rules

- **Keep it single-file and dependency-free.** No bundler, no new CDN scripts, no Python packages. The only external script is jsPDF from cdnjs with an SRI hash. This is about the app: `tools/` holds development-only scripts that never ship, are not referenced by the page, and use nothing outside the standard library.
- **CSP:** the server hashes each inline `<script>` block at startup (`page_csp`). Never use inline event handlers (`onclick="…"`), `eval`, or `new Function`; attach handlers in the script. Any new external host for images or fetches must be added to `page_csp`.
- **Escape everything** put into HTML with `esc()`: card names, deck text, Scryfall and MPC data and filenames are untrusted.
- **Server routes:** every route except `/healthz`, `/og.png` and the login requires sign-in (`signed_in()`). Upstream relays only reach allow-listed paths on fixed hosts. Keep request and response sizes bounded. Never let user input pick a host or a filesystem path outside `ASSETS`/`CACHE`.
- **Never show "MPC" in the UI.** Say "art search", "order prints" or "the autofill tool" instead. Code and comments can say MPC.
- **UI text:** short, plain labels; don't over-explain. The hint and help text is written in full sentences without jargon.
- **Edits:** keep changes surgical. Match the surrounding style (2-space indent, terse one-liners, few comments). Don't reformat or refactor nearby code.
- **Saved data:** settings and decks live in the user's IndexedDB. When renaming or removing a setting value, migrate old values in `cleanSettings` so existing users don't lose them.

## Commits and deploy

- Commit subjects describe the user-facing change, e.g. `Deck import: visible deck link field, Archidekt and Moxfield export formats`.
- Deploy is a `git pull` and `docker compose up -d --build` in the checkout on the host. The `cache` volume (card cache and session key) survives rebuilds, so logins persist.
