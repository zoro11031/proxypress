# Overhaul implementation record

Status: partial implementation; the complete brief is not accepted yet.

The starting checkout was main at ad32520 with an existing uncommitted 1,498-line HTML diff, an overhaul brief and a redesign probe. Those changes were preserved. The supplied handoff's completion claims were treated as unverified.

## Changes in this pass

- Compact rows with one visible quantity editor, visible options menu, Select/Done batch controls and keyboard-accessible issue buttons.
- More proof space at intermediate widths, inspector drawer, phone inspector exclusion and separated review/navigation footer space.
- One visible review action in each mode; review remains accessible when download is blocked.
- Actual populated back faces drive preflight and page counts. Unoccupied slot bounds are not validated as printed cards.
- Original sheet scope for PDF and matching cutter selection, original sheet filenames, job snapshot and export-change detection.
- Latest-generation review guard; readiness footer uses preflight instead of slot count.
- Add import destination/revision guard, immediate-content revision detection and shared modal cancellation for replacement review.
- Narrow parser header matching with original source line, line ID and section preservation.
- Duplex calibration selection before orientation transform; mismatched scoped back correction is not reused. Legacy calibration is estimated.
- Studio format availability reads template capacity from the installed manifest.
- Atomic durable project/UI/preset save with Saving/Saved/Save failed status and retry recovery.
- Preview cache recovery evicts only its own session-storage keys.
- Existing single-file/dependency-free app model retained; AGENTS local jsPDF note corrected.

## Verified commands

Browser commands use the current Python server through the harness. A pass requires app loaded: yes, probe: true, zero findings, and PASS with all observation channels proven live.

| Command | Result |
|---|---|
| `python3 -m py_compile proxy-press-server.py` | PASS |
| `node tools/desktop-server-check.js` | PASS |
| `node tools/release-check.js` | PASS |
| `python3 tools/suggestions-check.py` | PASS |
| `python3 tools/art-check.py` | PASS, 35 checks |
| `python3 tools/shares-check.py` | PASS, 37 checks |
| `node tools/console-check.js --probe tools/preflight-calibration-probe.js --deadline 90` | PASS after correcting export fingerprint to exclude transient render metadata |
| `node tools/console-check.js --probe tools/overhaul-reliability-probe.js --deadline 90` | PASS; including bare-name/source-section parser assertions |
| `node tools/console-check.js --probe tools/save-status-probe.js --deadline 90` | PASS, including injected quota failure and retry |
| `node tools/console-check.js --probe tools/studio3-probe.js --deadline 90` | PASS |
| `node tools/console-check.js --probe tools/foil-probe.js --deadline 90` | PASS |
| `node tools/console-check.js --probe tools/workspace-probe.js --width 1440 --height 900 --deadline 90` | PASS before final batch-control additions |
| `node tools/console-check.js --probe tools/sheet-export-probe.js --artifacts /tmp/proxypress-sheet-exports.json --deadline 90` | PASS first/middle/final single-sheet PDF comparison |
| `node tools/console-check.js --probe tools/workspace-visual-probe.js --width 1440 --height 900 --screenshot /tmp/proxypress-after-1440.png --deadline 90` | PASS; inspected, then corrected visible queue defects |
| Same visual probe at 1024×768 and 390×844 | PASS; screenshots inspected; phone inspector leak corrected and recaptured |
| `npm run pack` from electron/ | PASS; unpacked local jsPDF and Studio manifest present |
| `node tools/console-check.js --probe tools/selection-probe.js --deadline 120` | PASS after updating source-tab/Apply interaction and excluding transient metadata from revision checks |
| `git diff --check` | PASS |

The PDF artifacts were decoded to /tmp/proxypress-pdf-review and rasterized with `pdftoppm -scale-to 1200 -png`. Raster PNG bytes for full-job sheets 1, 2 and 3 exactly matched the three replacement-sheet exports. The partial final sheet raster was opened and inspected. The fixture uses local black artwork; this establishes placement parity, not print color accuracy.

Some parallel browser attempts ended with signal 143 without verdicts. These are inconclusive, not passes. The original workspace fixture also produced CSP violations from example.com artwork; local fixture sources replaced those URLs.

## Current action destinations and parity status

| Workflow | Current destination | Acceptance status |
|---|---|---|
| Project creation, switch, rename, duplicate, copy, clear/delete | Top project picker/menu | Existing handlers retained; full UI parity run pending |
| Backups, merge restore, compact packages, server shares | Settings & backup / existing share actions | Server checks pass; consolidation and round-trips pending |
| Paste/link/file/folder/XML/uploads | Cards → Add cards | Existing handlers retained; universal staging still pending |
| Unresolved lines and substitutions | Existing import review/input | Source metadata added; durable Resume import still pending |
| Per-copy/per-face art and custom cards | Proof, queue thumbnail/options, selected-copy actions | Selection regression passes through Local images, explicit Apply and copy remapping |
| Tokens/emblems, paired faces, suggestions | Add cards, suggestions and context menus | Existing handlers retained; complete workflow pending |
| Paper/layout/sides, stock, advanced geometry, calibration | Existing Print/Cut panes plus inspector | Unified single-owner Setup migration incomplete |
| PDF and cut files | Review export → Print files → Sheets | Single-sheet simplex PDF raster parity passes; complete duplex/cutter parity pending |
| Order gallery, common backs, stock, ZIP/XML | Order prints → Review order | Existing workflow retained; final ZIP/XML UI verification pending |
| Foil comparison and labeled test sheet | Inspector color tools / existing tuning dialog | Existing implementation retained; foil probe passes; physical reference pending |

## Work still required by the brief

- Finish removing the wizard after migrating every action; provide Cards/Proof/Setup phone navigation and one implementation per setting.
- Complete immutable job consumption by all geometry, proof, cutter and render helpers; use bounded source validation and issue routing throughout.
- Compare duplex replacement output and all SVG/DXF/Studio sheets, registration cases and partial-template behavior.
- Finish staged intake across every source, recoverable drafts, substitutions/corrections, and stale-operation recovery rather than merely refusing stale commits.
- Complete per-project setup migration, applied-profile state/provenance, alignment overlay, asset reachability/package merge coverage, desktop origin collision recovery and reload tests.
- Complete real Commander correction/art/order/backup/share/offline desktop workflow; test 360-card responsiveness and foil preview/export pixel isolation.
- Inspect 320px, short landscape, 200% zoom, blocked/loading/dialog states, real keyboard/touch interactions, and final captures after all edits.
- Exercise the unpacked Electron app with requests blocked; packaging and presence of files alone do not establish runtime offline parity.
- Prove new regression assertions fail under controlled isolated mutations; storage failure injection is covered, but a complete mutation audit is pending.

Physical-only checks remain separate: Actual Size dimensions, printer front/back registration, real cutter alignment, and comparison to matching flat/foil reference prints. No matching reference photograph was supplied.

No release, deployment or push was performed.
