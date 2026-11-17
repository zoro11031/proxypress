# ProxyPress overhaul verification

The implementation is on `main`. The audit reference is `ad32520`; subsequent workspace work in `11f2584` and `8f2b699` was reconciled and retained. The follow-up fixes restore the laptop Setup opener, restore focus after closing Setup, use width fitting in short windows, wrap artwork sources on phones, add keyboard context-menu navigation, and validate cut downloads against the captured print job. Stale export validation is rejected before it can open review for another project. The application remains one HTML file, with a standard-library Python server and the existing Electron/Docker delivery paths.

## Implementation slices

1. **Workspace:** the numbered wizard is retired. Cards, a single active-sheet proof, and editable Setup own the original controls. Intermediate windows use a Setup drawer; phones have Cards / Proof / Setup and a persistent review action. The queue has one quantity input per row, search, explicit batch selection, and Needs attention. Long names truncate with accessible full labels; three-digit quantities fit. A selected physical copy retains its face and sheet through artwork changes. The canonical settings and export nodes move into their destinations, retaining their event handlers.
2. **Print reliability:** `buildPrintJob` captures deck, settings, geometry, printer, calibration and original sheet indices. Proof, preflight, PDF and cutter calculations consume that snapshot. Actual faces determine duplex, including paired tokens. Occupied slots determine clipping and registration conflicts. Footer and review share generation-guarded validation. Missing bytes, corrupt images, retryable sources and low effective DPI have separate outcomes. A final PDF source check and revision check prevent stale downloads. Cut downloads also validate their selected sheet before building files.
3. **Import and artwork:** Add and Replace stage original source lines, sections, requested printings, substitutions and unresolved input. Destination/revision checks prevent late commits into another project. Cancel, Escape and backdrop settle the same pending operation; drafts offer Resume import. Partial completion retains unresolved lines. XML intake also stages, preserves a recoverable draft and bounds slot ranges. Artwork comparison has explicit scope, separate sources, retry, and stable copy/face routing. Order review captures stock, finish, deck and artwork for ZIP/XML generation.
4. **Persistence and tuning:** project print/order settings migrate from the prior global effective setup. Saving/Saved/Save failed follows atomic durable storage outcomes. Asset leases protect in-progress exports; reachability includes source layers, project backs, fonts, frame packs and Undo. Full backup merge remaps attachments, preset backs and frame images without overwriting existing image IDs; uploaded fonts no longer break backup export. Calibration resolves duplex before orientation and reports front/back provenance independently. The alignment overlay uses physical millimetres. Foil comparison renders Adjusted artwork and Estimated foil print at the same crop, with preview-only diffuse darkening/desaturation and optional reflection/tilt.

## Feature parity: action destinations

The retained selectors below identify the canonical handler owner. Tests exercise the destinations, not the removed wizard tabs. A retained capability is distinguished from a service or hardware operation that cannot be certified by a local fixture.

| Action | Destination / owner | Verification |
|---|---|---|
| New, switch, rename, duplicate, copy decklist, clear, delete; Undo replacement | Top project picker and project menu; `renderDeckSel`, `activateDeck`, `undoDeckReplacement` | Project migration/switch/reload, replacement and workflow probes; destructive confirmations retained |
| Paste / Add / Replace / Resume | Cards → Add cards; `listIn`, `importList`, `reviewReplacement` | Staged intake, cancellation, revision guards, partial results and replacement Undo |
| Moxfield / Archidekt / accepted text files | Cards → Add cards → Import deck | Python/Electron relay tests preserve legacy text plus versioned section rows; deterministic import resolver fixtures |
| Exact printing / substitutions / unresolved lines | Import review; unresolved draft and corrections | Distinct source-line identities, requested/resolved printing metadata, fallback review, bare names retained |
| Order XML and local image attachment | Add cards → Local images & order files | XML cancellation/resume/commit and malformed ranges; existing Attach images / Attach folder handlers retained |
| Bulk image upload, drag/drop, local folder matching | Add cards → Upload images / Local images & order files; global drop handler | Existing entry points retained; local art, source selection and byte round-trips exercised |
| Tokens, emblems, paired token faces, suggestions | Add cards → Add needed tokens; Cards that go with this deck; row menu → Choose token faces | Suggestions server/browser tests; Commander paired-token and face-routing fixtures |
| Find a copy / face; range selection; select matching copies | Searchable Cards queue and active proof; Select / Done; selected-copy actions | Selection, separated faces and Commander correction tests; exact edited copy stays selected, siblings unchanged |
| Community / Scryfall / local / instance artwork; filters, credit, retry | Thumbnail or row menu → Change art; Current / Candidate comparison | Workflow, source/readiness, instance-art server and sharing checks; explicit Apply scope |
| Upload or share one image; common back | Row menu → Upload image / Upload & share image; Setup → Sides / Order cardback | Local/remote art and order omission tests; authenticated instance-art checks |
| Custom card creation / editing, crop, frame, mana, fonts and source layers | Add cards → Create a card; row menu → Customize / Edit custom card | Workflow probe creates, reopens and packages editable art/pop-out/frame source keys; local frame/font availability checked in Electron |
| Presets, custom paper/card sizes, rotation, sides and duplex | Setup → Paper, layout & printer; original `paperForm`, `sidesForm` | Canonical field updates, project setting migration, duplex and geometry probes |
| Printer / driver / tray / stock guidance | Setup → printer and stock disclosures | Original fields and guidance retained; calibration status follows actual applied settings |
| Brightness, contrast, saturation, pearl, bleed and export quality | Setup → Color / advanced print disclosures | Quality, foil and source-DPI checks; cube input latency measured |
| Guides, per-card corner-guide color, safe/trim overlays | Proof → Guides; Setup guide fields; row menu → Corner guide color | Shared PDF/proof guide data retained; geometry and export parity checks |
| Calibration profiles, alignment, duplex and squareness sheets, manual measurement | Setup → Calibration and expected alignment overlay | Provenance, duplex round-trip/scan, squareness and profile probes; physical results remain unmeasured here |
| Rotary/Cameo, registration, SVG/DXF/Studio | Setup → Cut; Review export → matching cut file | Installed manifest determines eight/nine-slot Studio availability; 36 first/middle/final download byte comparisons |
| All-sheet PDF / current-sheet reprint | Review export → Sheets → All sheets / Current sheet | Original numbering, matching blank back positions, nine PDF raster comparisons |
| Print, feed/flip and cutter instructions | Review export | Canonical instructions retained, including Actual Size and Studio Basic/DXF guidance |
| Order gallery, front/back/common back, stock and finish | Top → Order prints; gallery; Review order | Order-specific readiness; ZIP/XML snapshot, omissions, indices and uploaded byte preservation |
| Order ZIP / XML-only / cap and splitting guidance | Review order | Workflow and order snapshot probes; bundle retains uploads while XML-only reports unsupported uploads |
| Compact editable deck file / optional shared layout | Project sharing actions / Settings & backup; Add cards → Import deck | Workflow and offline Electron export/import/reopen; missing asset rejection |
| Full backup / merge restore | Settings & backup | Populated-store collisions, source/back/preset/frame remapping, font serialization and missing attachment rejection |
| Create/revoke share / anonymous view / save a copy | Project sharing actions; Settings → Manage shared decks; shared landing | Authenticated browser sharing and public capability harness; 37 server access-scope checks |
| Save status and storage recovery | Top bar; Settings & backup | Injected quota failure, atomic transaction failure and successful retry |
| Help / tour | Top Help | Original contextual instructions retained; tour no longer covers a reopened populated project automatically |
| Foil estimate / reflection / labeled test sheet / tested setup | Setup → Color tuning / foil comparison; printer-stock presets | Modal exercised; export pixels and cut geometry identical across preview reflection/tilt settings |

Full backups carry uploaded font/frame metadata. Existing font slots are retained when merging into a populated installation; missing slots are filled from the backup. Compact/shared decks retain explicit card art/frame/pop-out source layers; machine calibration stays local. Do not infer that a recipient has the sender's globally installed commercial fonts or every server frame pack.

## Exact checks and results

Run from the repository root unless noted. Browser passes require `app loaded: yes`, `probe: true`, zero findings, `PASS - page clean`, all four observation channels proven live and both controls clean. The harness now writes `{}` when a successful probe has no optional artifact payload; it previously misreported those probes as inconclusive.

`--offline-fixtures` suppresses the idle upstream cache warmer only. The fixture controls its own sources. The default live console check remains unchanged; this flag does not certify availability of a third-party service.

| Command | Result |
|---|---|
| `python3 -m py_compile proxy-press-server.py` | PASS |
| `node tools/desktop-server-check.js` | PASS |
| `node tools/release-check.js` | PASS |
| `python3 tools/deck-relay-check.py` | PASS |
| `python3 tools/suggestions-check.py` | PASS |
| `python3 tools/art-check.py` | PASS, 35 checks |
| `python3 tools/shares-check.py --browser` | PASS, public browser fixture and 37 server checks |
| `node tools/overhaul-check.js` | PASS for its 17-case run; cutter comparisons and narrow dialogs were added/run separately afterward |
| `node tools/console-check.js --offline-fixtures --probe tools/occupied-registration-probe.js --deadline 90` | PASS: empty edge slots and original sheet identity |
| `node tools/console-check.js --offline-fixtures --probe tools/cut-sheet-export-probe.js --artifacts out/overhaul-review/checks/cut-parity.json --deadline 150` | PASS, 36 byte-identical downloads; blocked geometry prevents download |
| `node tools/console-check.js --offline-fixtures --probe tools/commander-workflow-probe.js --width 390 --height 844 --deadline 150` | PASS after final download validation change |
| `node tools/console-check.js --offline-fixtures --probe tools/navigation-probe.js --width 1024 --height 768 --deadline 90` | PASS after final visible Setup opener/focus fix |
| `node tools/console-check.js --offline-fixtures --probe tools/navigation-probe.js --width 390 --height 844 --touch-selector '[data-mview=setup]' --deadline 90` | PASS; CDP touch reached the actual app and opened Setup |
| `node tools/console-check.js --offline-fixtures --probe tools/navigation-probe.js --width 720 --height 450 --scale 2 --deadline 90` | PASS, 200% equivalent reflow at 1440×900 physical pixels |
| `npm ci` and `npm run pack` in `electron/` | PASS, unpacked Linux app with local assets |
| `node tools/electron-offline-check.js --profile /tmp/proxypress-final-desktop-profile` | PASS, real Electron renderer, external requests blocked, PDF/cutters, frames/fonts, durable reopening |
| `node tools/electron-offline-check.js --profile /tmp/proxypress-final-desktop-profile --collision --expect-existing` | PASS, same saved project after restart, no requests to the foreign service |
| `docker build -t proxypress:overhaul-check .` | PASS |
| `node tools/console-check.js --url http://127.0.0.1:18642 --password overhaul-check --offline-fixtures --probe tools/navigation-probe.js --width 1024 --height 768 --deadline 90` | PASS against an isolated read-only, non-root, cap-dropped container |

The extended regression run uses this exact command for each name: `node tools/console-check.js --offline-fixtures --probe tools/NAME-probe.js --deadline 150`. Names: `duplex`, `duplex-roundtrip`, `duplex-scan`, `squareness`, `studio3`, `dxf`, `regmark`, `calprofile`, `workflow`, `sharing`, `preflight-calibration`, `save-status`, `deck-replace`, `import-suggestions`. All 14 passed. The registration fixture was corrected to place a mark inside an occupied card; reducing an unused grid margin no longer establishes a collision. Per-case results are recorded in `out/overhaul-review/checks/extended-results.json`; do not treat an unfinished or missing result as a pass.

The 17-case aggregate covers desktop/phone navigation, immutable jobs, remote/local readiness, staged imports, XML intake, project settings, backup merging, calibration provenance, occupied registration, copy selection, face routing, Commander phone workflow, order snapshots, replacement PDFs, foil isolation and the 360-card cube. The runner now additionally includes cutter parity and narrow dialogs (19 cases total) so subsequent runs retain that coverage. CI runs the browser set sequentially and uploads its logs; the remote GitHub workflow itself has not been executed in this session.

**Output evidence:** `sheet-export-probe` compares first/middle/final PDF content streams for simplex and mixed DFC jobs. The eight resulting PDFs were rasterized with `pdftoppm -scale-to 1200 -png`. All three simplex and six duplex replacement page PNGs were byte-identical to their full-job counterparts, including intentionally blank reverse pages. PDF/image fixtures are under `out/overhaul-review/pdf/`; the black-art fixture establishes geometry, not color accuracy. Cutter comparisons span all four installed templates; Studio partial sheets intentionally keep the fixed template slot count, while SVG/DXF contain only occupied outlines.

**Performance:** the latest cube fixture contains 360 cards and 45 sheets with one proof page mounted. Measured render time was 196.6 ms and slider input p95 was 0.8 ms on this machine. Preview entries were 20 and decoded-image entries 8. These are fixture measurements, not a comparative benchmark or a hardware-independent guarantee.

**Negative checks:** quota and upstream failure injection prove save/retry and readiness recovery. An isolated registration mutation made the occupied-slot probe fail with “empty edge positions do not block output,” proving the new check detects the old behavior. Isolated calibration mutations (without touching the working file) reintroduced the orientation/duplex bugs and made the provenance probe fail on the intended assertions. Earlier killed browser runs and the artifact-harness failures were inconclusive and are excluded from passes.

## Rendered evidence

Screens were captured from running Python apps with isolated browser stores and opened for visual inspection. The audited `ad32520` replay supplies before views; these are reconstructed comparison captures, not untouched personal projects. The original working-tree baseline capture is also retained locally. Final screenshots use downloaded Scryfall card images stored as local fixture attachments; resolution warnings are intentional for these preview-size images.

| View | Before | After |
|---|---|---|
| 1440×900 | [Before](docs/overhaul-review/before-1440.png) | [After](docs/overhaul-review/after-1440.png) |
| 1024×768 | [Before](docs/overhaul-review/before-1024.png) | [After](docs/overhaul-review/after-1024.png) |
| 390×844 | [Before](docs/overhaul-review/before-390.png) | [After](docs/overhaul-review/after-390.png) |

Additional captures: [320px](docs/overhaul-review/after-320.png), [short landscape](docs/overhaul-review/landscape-844.png), [200% equivalent](docs/overhaul-review/zoom-equivalent.png), [touch Setup](docs/overhaul-review/phone-touch-setup.png), [empty](docs/overhaul-review/empty-phone.png), [blocked review](docs/overhaul-review/blocked-phone.png), [loading artwork](docs/overhaul-review/loading-phone.png), [art comparison](docs/overhaul-review/art-phone.png), and [foil comparison](docs/overhaul-review/foil-desktop.png). Intentional proof scrolling stays inside the stage. The last short-window correction uses Fit width so artwork stays readable. `narrow-dialog-probe` passes at 320×740 and 390×844, including modal bounds, source tabs, Current/Candidate switching, focus trapping, a menu at the bottom-right corner, arrow navigation and Escape focus restoration.

Reproduce rendered comparison captures with `node tools/capture-workspace.js --width 1440 --height 900 --output out/overhaul-review/screens/after-1440.png`. Repeat at 1024×768 and 390×844. Use `--state empty`, `--state blocked`, `--state loading`, `--state art` or `--state foil` for the additional views. The tool downloads four preview images into its ignored fixture cache. To replay the audited baseline, place its HTML/server in an isolated directory with an assets symlink and pass `--baseline /path/to/isolated-baseline`.

## Migration and practical limits

- IndexedDB name/version and existing project/image IDs are preserved. Old projects inherit their previous global effective print settings; new saves retain per-project paper/layout/color/back and order stock/finish. Machine calibration remains local and front/back measurement provenance is shown independently.
- Desktop keeps the established `http://127.0.0.1:8642` renderer origin even when the internal server must use another port. The installed protocol handler forwards to that internal port. This prevents new port collisions from creating an empty storage origin. Historical data previously saved under an arbitrary fallback origin is not silently migrated; recover such an old installation through its backup/original origin.
- Existing legacy calibration is retained as estimated when scope is unknown. The orientation conversion retains the documented short-edge-first convention; it is not a physical measurement of every possible feed edge or tray.
- Preview reflection, tilt and diffuse foil simulation do not change export pixels or cut geometry. No matching flat/foil printed photograph was supplied; tonal defaults remain adjustable estimates.
- Actual browser zoom is represented by an equivalent reduced CSS viewport with doubled device scale. Touch is CDP emulation and keyboard actions are browser fixture events. Physical mobile browser keyboard/file-picker/download behavior still needs a device check.
- Real upstream provider availability is separate from deterministic resolver tests. Scryfall artwork was fetched for visual evidence; account-specific deck-link services were not certified end to end.
- Hardware checks remain: Actual Size dimensions on intended stock, front/back feed registration, a real cutter pen/blade pass, and locked-exposure matching flat/foil print comparisons. No printer/cutter/foil reference was available in this environment.

No deployment or remote push is part of this change. The local container smoke-test instance is removed after verification. A committed [check summary](docs/overhaul-review/checks.json) records the run groups and output parity. Raw logs and generated PDFs remain in ignored `out/overhaul-review/`; selected screenshots and this checklist are committed for review.
