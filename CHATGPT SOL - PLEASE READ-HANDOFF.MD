# Handoff: ProxyPress Workspace Redesign & Reliability Overhaul

## 1. Project & Repository Context
- **Repository**: `zoro11031/proxypress`
- **Working Tree**: Branch `main` (commit `ad32520` or newer).
- **Core Architecture Rules (`AGENTS.md`)**:
  - **Single-File App**: `proxy-press.html` contains the entire client (HTML, CSS, JS inline). No npm, no bundlers, no external frameworks.
  - **Server**: `proxy-press-server.py` using Python standard library only.
  - **Strict CSP**: Server hashes `<script>` blocks at startup. **Never use inline event handlers** (`onclick="..."`, etc.). All event listeners must be registered via `.addEventListener()` or `.onclick = ...` in the script.
  - **Terminology**: **Never show "MPC" in the UI.** Use "art search", "order prints", or "the autofill tool".
  - **HTML Escaping**: Escape all untrusted user/card strings with `esc()`.
  - **Verification Method**: Always test with `node tools/console-check.js --probe tools/<probe>.js`. Judge runs by logs (`probe: true`, `PASS`, 0 findings), not just exit codes.

---

## 2. Visual Reference
- Reference Image: `uploaded_media_1794855269857.jpg` (Three-column desktop layout)
- **Layout Architecture**:
  - **Left**: Card Queue (`aside`) with search, "Needs attention" filter toggle, copy counts, card rows with issue badges.
  - **Center**: Single-sheet Live Proof stage (`#stage`) with sheet label ("Sheet 1 of 1"), sheet jump/pagination, independent Front/Back/Guides toggles, and live crop/trim dimensions.
  - **Right**: Inspector (`#workspaceInspector`) with quick setup summary, expandable stock/printer tuning, color/foil simulation controls.
  - **Bottom**: Unified persistent footer with readiness status and "Review export" trigger.

---

## 3. What Has Been Completed & Verified

### A. Four Core Reliability Fixes (Prior Passes)
1. **Deck Replacement Staging & Undo**: `importList()` stages incoming decklists, validates matching revisions, and preserves original art, quantities, and custom cards if canceled or unresolved. Undo snapshot support with referenced image retention.
2. **Authoritative Preflight**: Unified `checkFaces()` rules driving both the Review Export modal and PDF export entry points. Blocks invalid geometries (e.g. 5×2 on Letter Landscape) and missing art.
3. **Offline PDF Export & Local Asset Delivery**: Local jsPDF bundling and `.studio3` asset serving in Electron package.
4. **Calibration Model**: Distinguishes measured profiles from estimated presets and reflects paper size feedability.

### B. Workspace Redesign & Card Queue Overhaul
1. **Artwork Picker Comparison View (`openMpcPicker`)**:
   - Side-by-side comparison (or mobile toggle) between **Current Artwork** and **Candidate Artwork**.
   - Physical trim crop box overlay with calculated effective DPI (`naturalWidth / (cardW / 25.4)`) or `"Resolution unknown"`.
   - Distinct source tabs: **Printings** (Scryfall), **Community art** (MPC), and **Local images**.
   - DFC-aware headers indicating the active face being edited (e.g. `Delver of Secrets · editing Back (Insectile Aberration)`).
   - Scoped button labels: `"Apply to this copy"`, `"Apply to 4 copies"`, `"Apply to all copies"`.
   - Manual art choice lock: setting artwork marks `f.manual = true`, protecting user selections from being overwritten by subsequent autofill runs (`mpcAutofill`).
   - Copy splitting remapping: when a single copy of a multi-copy entry is edited, `applyArtChoice` splits the entry, assigns a new UID, and remaps `selectedCopies` to the new copy so the user retains their selection, sheet, side, and zoom.
2. **Sequential Issue Fixing Workflow**:
   - `getCardIssues(entry, slots, settings)` and `getPrintJobIssues()` evaluate issues affecting only the active print job (e.g. cards whose backs won't print stay out of the issue queue).
   - Issue badges rendered in card queue rows: `.queue-issue-badge` (`Missing art`, `Missing back`, `Low resolution`, `Unreadable image`).
   - Clicking an issue badge routes directly to the affected sheet and copy (`findIssueTarget`, `showSheet`, `selectCardCopy`, `openMpcPicker`).
   - Modal contains an issue banner (`#pickerIssueBar`) showing the active issue and remaining issue count, with sequential navigation.
3. **ProxyJak Rainbow Foil Tone Model & Test Sheet**:
   - `applyFoilToneModel(canvas, params)`: Simulates midtone darkening (gamma 1.25), shadow crush, and metallic saturation loss.
   - `openFoilToneModal()`: Modal with comparison between "Adjusted artwork" and "Estimated foil print", live reflection/tilt sheen toggle, and print adjustment sliders (`brightness`, `saturation`, `contrast`).
   - `printFoilTestSheet()`: Exports a 1-page PDF featuring 3 card calibrations (neutral, current deck settings, alternate) alongside a 10-step gray calibration ramp (0% to 100% K).
4. **Single-Sheet Live Proof**:
   - `drawPreview()` renders only `pages[S.activeSheet]`, updating `#proofSheetLabel`, `#sheetJumpSel`, Previous/Next buttons, and Front/Back toggles.

---

## 4. Current Test Probes & Health

| Test Probe | Command | Status |
|---|---|---|
| Syntax check | `python3 -m py_compile proxy-press-server.py` | **PASS** |
| Workspace 3-column & proof | `node tools/console-check.js --probe tools/workspace-probe.js` | **PASS (0 findings, 4/4 channels live)** |
| Foil simulation & settings | `node tools/console-check.js --probe tools/foil-probe.js` | **PASS (0 findings, 4/4 channels live)** |
| Deck replacement & undo | `node tools/console-check.js --probe tools/deck-replace-probe.js` | **PASS** |
| Preflight & calibration | `node tools/console-check.js --probe tools/preflight-calibration-probe.js` | **PASS** |
| Full redesign acceptance check | `node tools/console-check.js --probe tools/workspace-redesign-probe.js` | In progress (see below) |

---

## 5. Immediate Next Steps for GPT

### Step 1: Polish Test Fixture in `tools/workspace-redesign-probe.js`
In `tools/workspace-redesign-probe.js`:
- In headless Chromium with CDP log monitoring, untrusted/dummy external image URLs (like `https://cards.scryfall.io/normal/front/1/1/11.jpg`) emit a network 404 finding because the dummy URL doesn't exist on Scryfall's CDN.
- Use a 1x1 transparent PNG data URI (`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`) or stored mock blobs for probe cards.
- Ensure fixture cards intended to be "ready" include `drive: 'mock'` and `mpcDpi: 600` so `isPreview(face)` does not mark them as low-res Scryfall placeholders.
- Verify `node tools/console-check.js --probe tools/workspace-redesign-probe.js` exits with `PASS` and 0 findings.

### Step 2: Capture Visual Proof Screenshots
Run console-check with viewport options to save verification screenshots:
```bash
node tools/console-check.js --width 1440 --height 900 --screenshot workspace-desktop.png
node tools/console-check.js --width 390 --height 844 --screenshot workspace-mobile.png
```

### Step 3: Run Full Regression Suite
Verify cutting, calibration, and wizard probes:
```bash
node tools/console-check.js --probe tools/calprofile-probe.js
node tools/console-check.js --probe tools/wizard-probe.js
node tools/console-check.js --probe tools/studio3-probe.js
node tools/console-check.js --probe tools/duplex-probe.js
```

### Step 4: Commit and Push
Follow `AGENTS.md` commit convention:
```bash
git add proxy-press.html tools/workspace-probe.js tools/workspace-redesign-probe.js "CHATGPT SOL - PLEASE READ-HANDOFF.MD"
git commit -m "Workspace redesign: comparison art picker, sequential issue correction, and foil tone simulation"
git push origin main
```
