# v0.8 follow-up implementation

Baseline: `97269fa`, reconciled against `ProxyPress-v0.8-follow-up-audit.md` (audited at `8f2b699`). The existing Setup opener and download revision guards were retained. The user's deleted prior briefs/handoffs were left deleted. No new application dependencies, endpoints, or release version were introduced.

## Changes and destinations

- Import correction **Use** edits its exact source row and persists the draft. **Add** uses the staged command, capturing project, draft and source position before lookup. Late resolution cannot add to another project. Text drafts now retain IDs and source-row metadata through cleaning/reload. Import review offers section inclusion; exact source lines are collapsed. Replacement confirmation and Undo remain.
- Queue labels are keyboard-focusable Jump to proof actions. Quantity updates preserve the input node and focus. Issue pills wrap within the label area. Zero-copy entries no longer create issues; a shared missing back is represented once per job and routes to its own picker. Exact-copy warning routing preserves copy, face and sheet. Corrections stay on the edited copy; Next issue is explicit.
- Printings retry preserves the failed page cursor. Applying a local search result stays private; matched current artwork has a separate Share current artwork action on the server.
- Setup summary Paper/Sides/Cut buttons reveal the original controls. The default form stack is collapsed. Drawer offsets follow the actual header/footer; collapse no longer overrides proof focus or leaks its grid into Order. Home Setup is hidden in Order. Opener accessibility state is synchronized.
- Fit ignores hidden stages, measures toolbar layout independently of scroll position, and no longer saves derived zoom. Save failure is concise and offers Retry save.
- Print review starts with scope/job summary and blocking issues. PDF and cutter buttons share the validation verdict. Matching cut-sheet selection stays within review. Sharing/offline files and instructions are collapsed. Blank-back replacement sheets retain duplex wording and explicitly identify the blank reverse page.
- Calibration overlay omits absent faces and empty fallback slots. Show on proof and opacity controls are preview-only; selected duplex copies report center displacement in millimetres.
- Foil comparison uses the real renderer and trim crop, including pearl and source bleed. It selects the visible face, avoids compounded CSS filtering, and rejects obsolete async renders. Test-sheet inputs are captured, samples paginate at real card size, and labels/ramp respect usable paper width. Very small sheets reject before output.
- README package examples now match v0.8.0. Browser regression CI includes the new correctness probe. The cube fixture now uses 360 distinct images, delayed image loads, and completed-image/frame timing.

## Verification

Every passing browser run required `app loaded: yes`, `probe: true`, zero findings and the harness's live-channel/self-test PASS. The following commands were exercised:

- `python3 -m py_compile proxy-press-server.py`
- `node tools/desktop-server-check.js`
- `node tools/release-check.js`
- `python3 tools/deck-relay-check.py`
- `python3 tools/suggestions-check.py`
- `python3 tools/art-check.py` (35 checks)
- `python3 tools/shares-check.py --browser` (public browser and 37 access-scope checks)
- `node tools/overhaul-check.js out/follow-up-checks` — initial run: 19 PASS, cube focus fixture failure. The fixture was updated to reveal Setup before focusing its slider and rerun separately; retain the original log rather than treating that initial failure as a pass.
- `node tools/console-check.js --offline-fixtures --probe tools/followup-correctness-probe.js --deadline 120` — PASS, including exact-copy routing, zero quantities, quantity focus, staged section cancellation, foil paper bounds/pagination, first-page/pagination Printings retries and switching projects during a correction lookup.
- `node tools/console-check.js --offline-fixtures --probe tools/staged-import-probe.js --deadline 90` — PASS after draft/section changes.
- `node tools/console-check.js --offline-fixtures --probe tools/save-status-probe.js --deadline 90` — PASS including failure/retry.
- `node tools/console-check.js --offline-fixtures --probe tools/calibration-provenance-probe.js --deadline 90` — PASS, overlay/provenance regression.
- `node tools/console-check.js --offline-fixtures --probe tools/cut-sheet-export-probe.js --deadline 150` — PASS, all 36 file comparisons and stale/blocked export checks.
- `node tools/console-check.js --offline-fixtures --probe tools/navigation-probe.js --width WIDTH --height 768 --pointer-selector '#toggleInspector' --pointer-assert '!!document.querySelector("#workspaceInspector").getClientRects().length' --deadline 90` — PASS at 821, 1024, 1100 and 1101 CSS pixels; CDP pointer clicks reached the visible opener and revealed Setup.
- `node tools/console-check.js --offline-fixtures --probe tools/cube-performance-probe.js --artifacts out/follow-up-cube.json --deadline 150` — separate final distinct-image run; its measured results are in the artifact.
- `npm run pack` in `electron/`; `node tools/electron-offline-check.js --profile /tmp/proxypress-followup-profile`; repeat with `--collision --expect-existing` — actual unpacked runtime checks, external requests blocked, local assets/exports/reopening and stable origin.
- `docker build -t proxypress:follow-up-check .` — PASS. A read-only, cap-dropped instance on localhost:18643 also passed the 1024px navigation probe, then was removed.
- `git diff --check`.

The CI runner now also includes the four pointer breakpoint cases (24 total). The completed initial batch plus targeted follow-up runs provide this session’s evidence; a remote CI execution is not claimed. The final distinct-image fixture added an 8ms load delay per source, waited for visible images and two animation frames, and measured 484.7ms first proof and 72.4ms completed-update p95, with 96 preview entries and seven decoded entries. These are machine/fixture measurements, not comparisons to the old synchronous input-handler timing.

The new correctness probe was also run against an isolated copy of the old revision. It failed on exact-copy routing, zero-quantity issues, foil clipping/pagination, Printings retry and correction staging. The working source was not mutated for that negative check.

Foil PDFs were exported with the bundled jsPDF, captured in `out/follow-up-foil-pdfs.json`, decoded, and rasterized with `pdftoppm -scale-to 1000 -png`. Letter portrait, A4 portrait, landscape and a 100×160mm custom page were exercised. Letter portrait now uses two pages; the small sheet uses three. Raster images were opened for inspection. These black-art geometry fixtures do not establish physical color accuracy.

## Rendered evidence

Live app captures: [1440px](docs/follow-up-review/1440.png), [1024px](docs/follow-up-review/1024.png), [390px](docs/follow-up-review/390.png), [320px](docs/follow-up-review/320.png), [phone artwork](docs/follow-up-review/art-phone.png), [foil](docs/follow-up-review/foil.png), [phone blocked review](docs/follow-up-review/review-phone.png). The existing `docs/overhaul-review/` preserves the earlier before/after comparison set. Source preview images intentionally trigger resolution warnings.

Reproduce captures with `node tools/capture-workspace.js --width 1024 --height 768 --output out/follow-up-1024.png`; use `--state art`, `--state foil` or `--state blocked` for dialogs. Raw logs, timing and PDFs remain under ignored `out/`.

## Limits

Physical Actual Size, front/back feed alignment, cutter passes, matching flat/foil references, and real-phone keyboard/file-picker behavior still need equipment. Pointer and touch/browser fixtures are emulation. The foil model remains an estimate. Independent live provider uptime and remote CI execution are separate from deterministic local checks. No production deployment or remote push was performed.
