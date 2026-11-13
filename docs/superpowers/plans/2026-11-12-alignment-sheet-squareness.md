# Alignment Sheet Squareness Gauge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the alignment sheet show, at a glance and then as a number, whether the print is rotated relative to the paper edge.

**Architecture:** A pure `squarenessMarks(L)` returns the gauge geometry and the degrees-per-millimetre conversion for the current page, following the existing `guideLines(L, …)` pattern of returning drawing data rather than drawing. `btnCal` consumes it. A probe asserts the numbers without producing a PDF.

**Tech Stack:** jsPDF 2.5.1 (already loaded, SRI-pinned), vanilla JS in `proxy-press.html`, `tools/console-check.js` with `--probe` for verification. No test framework exists in this repo; probe assertions are the test tier.

**Spec:** `docs/superpowers/specs/2026-11-12-alignment-sheet-squareness-design.md`

## Global Constraints

- Single file, no bundler, no new dependencies, no new CDN scripts. `tools/` is dev-only and standard-library/node-builtin only.
- Strict CSP: no inline handlers, no `eval`, no `new Function`. CSP violations never reach `console` — only `tools/console-check.js` catches them.
- Match surrounding style: 2-space indent, terse one-liners, few comments. No reformatting of nearby code.
- All gauge geometry in page millimetres, drawn through `makeT(L, false)` like the rest of the sheet.
- Corner crosses stay at their current 10 mm inset and keep their current role.
- The 5 mm non-printable margin is a hard floor: no printed feature closer than 5 mm to the nominal edge.
- Exact values from the spec: margin line inset **6 mm**; scale span **5 mm to 15 mm**; tick step **0.5 mm**; labels at **5 / 10 / 15**; cross inset **10 mm**.

## Review Focus

1. **Portrait orientation** — `span.y` and `span.x` swap with the page; a conversion hard-coded to the landscape span silently reports the wrong angle. Covered in Task 1.
2. **Small page sizes** (A6, 105 × 148 mm) — two 10 mm-long corner scales plus their labels must not collide along the short edge. Covered in Task 1.
3. **Non-unity printer scale** — everything draws through `makeT`, so at `scaleX ≠ 100` a mark labelled "10.0 mm from the edge" is no longer 10 mm from the edge. The sheet's existing step order already requires A and B to read 100.0 mm first; the new copy must not contradict that. Covered in Task 3.
4. **Printers with a margin larger than 5 mm** (some leave 6.35 mm) — the 6 mm margin line would be clipped and read as absent rather than as a problem. The copy must say what a missing line means. Covered in Task 3.
5. **Degenerate page sizes** — a custom page under ~40 mm on a side leaves no room between opposing scales; the gauge must omit itself rather than draw overlapping garbage. Covered in Task 1.

---

### Task 1: `squarenessMarks(L)` geometry and conversion

**Files:**
- Modify: `proxy-press.html` — new function beside `guideLines` (around line 1483)
- Test: `tools/squareness-probe.js` (create)

**Interfaces:**
- Consumes: `layout()` → `L`, using `L.W` and `L.H` (page size in mm).
- Produces: `squarenessMarks(L)` → `{band, scale, span, degPerMm, lines}` where
  `band` is the margin-line inset in mm (6),
  `scale` is `{from, to, step, labels}` = `{5, 15, 0.5, [5, 10, 15]}`,
  `span` is `{x, y}` in mm between opposing corner crosses,
  `degPerMm` is `{x, y}` degrees of skew per mm of corner-to-corner difference,
  `lines` is an array of `[x1, y1, x2, y2]` segments in page mm (4 margin lines, then the corner scale ticks).
  Returns `null` when the page is too small for the gauge.

- [ ] **Step 1: Write the failing test**

Create `tools/squareness-probe.js` in the style of `tools/duplex-probe.js` (IIFE, `eq(name, got, want)` collecting into `fails`, saves and restores `S.settings`, returns `true` or `{fails}`):

```js
S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape', pageW:279.4, pageH:215.9};
let m = squarenessMarks(layout());
eq('band', m.band, 6);
eq('scale span', [m.scale.from, m.scale.to, m.scale.step].join(), '5,15,0.5');
eq('landscape span x', +m.span.x.toFixed(1), 259.4);
eq('landscape span y', +m.span.y.toFixed(1), 195.9);
eq('landscape deg/mm x', +m.degPerMm.x.toFixed(4), 0.2209);
eq('landscape deg/mm y', +m.degPerMm.y.toFixed(4), 0.2925);
// The user's measured 1.588 mm must come back as the 0.351 deg in the spec.
eq('worked example', +(1.588 * m.degPerMm.x).toFixed(3), 0.351);
// Portrait swaps the spans; a hard-coded landscape conversion fails here.
S.settings = {...DEFAULTS, pageSize:'letter', orientation:'portrait', pageW:215.9, pageH:279.4};
m = squarenessMarks(layout());
eq('portrait span x', +m.span.x.toFixed(1), 195.9);
eq('portrait span y', +m.span.y.toFixed(1), 259.4);
// Nothing may be drawn inside the 5 mm non-printable margin.
const all = m.lines.flatMap(([x1, y1, x2, y2]) => [x1, x2, y1, y2]);
eq('clears 5mm margin', all.every(v => v >= 5 - 1e-9), true);
eq('within page', m.lines.every(([x1, y1, x2, y2]) =>
  Math.max(x1, x2) <= layout().W - 5 + 1e-9 && Math.max(y1, y2) <= layout().H - 5 + 1e-9), true);
// A6 must still fit without opposing scales meeting.
S.settings = {...DEFAULTS, pageSize:'a6', orientation:'portrait', pageW:105, pageH:148};
eq('a6 fits', squarenessMarks(layout()) !== null, true);
// A page with no room omits the gauge rather than drawing overlapping marks.
S.settings = {...DEFAULTS, pageSize:'letter', orientation:'portrait', pageW:38, pageH:38};
eq('tiny page omitted', squarenessMarks(layout()), null);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tools/console-check.js --probe tools/squareness-probe.js`
Expected: FAIL, `probe: {"fails":["threw: squarenessMarks is not defined"]}`

- [ ] **Step 3: Implement `squarenessMarks(L)` in `proxy-press.html`**

Place it immediately after `guideLines`. Return `null` when `Math.min(L.W, L.H) < 2 * 15 + 8` so opposing 15 mm scales cannot meet. `degPerMm` is `Math.atan(1 / span) * 180 / Math.PI` per axis. The four margin lines run at `band` from each edge, between the corner crosses (from 10 to `L.W - 10`, or `L.H - 10`). Corner scale ticks run perpendicular to each adjacent edge across `scale.from`..`scale.to`, stepping by `scale.step`, with longer ticks at the labelled values.

- [ ] **Step 4: Run it and watch it pass**

Run: `node tools/console-check.js --probe tools/squareness-probe.js`
Expected: `probe: true`, `PASS`

- [ ] **Step 5: Commit**

```bash
git add proxy-press.html tools/squareness-probe.js
git commit -m "Alignment sheet: squareness gauge geometry and skew conversion"
```

- [ ] **Step 6: Prove the assertions are live**

Per `AGENTS.md`, an assertion that passes first time has tested nothing, and the mutation comes *after* the commit so that reverting it cannot discard uncommitted work. Copy `proxy-press.html` to the scratchpad, change `band` to 7 and make the portrait branch reuse the landscape span, run the probe, and confirm `band` and `portrait span x` both fail. Restore from the scratchpad copy, not `git checkout`. Re-run and confirm `probe: true`.

---

### Task 2: Draw the gauge on the alignment sheet

**Files:**
- Modify: `proxy-press.html` — `$('#btnCal').onclick`, after the corner-cross loop (around line 5696)
- Test: `tools/squareness-probe.js` (extend)

**Interfaces:**
- Consumes: `squarenessMarks(L)` from Task 1; `makeT(L, false)`, `pdfText`, and jsPDF's `doc.line` / `doc.text` as already used in `btnCal`.
- Produces: no new exports. The sheet gains the margin lines, the corner scales and their labels.

- [ ] **Step 1: Pin the contract the drawing relies on**

`btnCal` ends in `doc.save(...)`, so calling it from a probe downloads a file rather than returning anything inspectable; there is no honest unit test for "the sheet drew these lines". The probe guards the *contract* instead, and the drawing itself is verified by rasterising in Step 5. Add to `tools/squareness-probe.js`:

```js
const m2 = squarenessMarks(layout());
eq('four margin lines first', m2.lines.slice(0, 4).every(([x1, y1, x2, y2]) => x1 === x2 || y1 === y2), true);
eq('ticks follow the margin lines', m2.lines.length > 4, true);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tools/console-check.js --probe tools/squareness-probe.js`
Expected: FAIL until Task 1's `lines` puts the four margin lines first and appends the ticks. If it passes immediately, Task 1 already satisfied it and this step has proved nothing — reorder `lines` to put a tick first, watch `four margin lines first` fail, then restore.

- [ ] **Step 3: Draw the marks in `btnCal`**

After the existing `for (const [x, y] of [[10, 10], …]) pdfCross(doc, T, x, y);` loop, draw each segment from `squarenessMarks(L).lines` with `doc.setLineWidth(0.2)` and `doc.line(T.x(x1), T.y(y1), T.x(x2), T.y(y2))`, skipping when the function returns `null`. Label the scales at `scale.labels` with `doc.setFontSize(5.5)`, outside the ticks so the labels never sit between a tick and the paper edge.

- [ ] **Step 4: Run the checks**

Run: `python3 -m py_compile proxy-press-server.py && node tools/console-check.js --probe tools/squareness-probe.js`
Expected: `py_compile` silent, `probe: true`, `PASS`

- [ ] **Step 5: Look at the sheet rasterised**

`AGENTS.md` requires it for layout changes: export the alignment sheet, then
`gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r100 -sOutputFile=<scratchpad>/cal.png <sheet>.pdf` and read the image. Check in both orientations that the margin lines do not collide with the A/B scale bars, the card outline or the instruction block, and that the corner labels are legible at 5.5 pt.

- [ ] **Step 6: Commit**

```bash
git add proxy-press.html tools/squareness-probe.js
git commit -m "Alignment sheet: draw margin lines and corner scales"
```

---

### Task 3: Instructions and on-sheet arithmetic

**Files:**
- Modify: `proxy-press.html` — the `WHAT TO DO` block in `$('#btnCal').onclick` (around line 5745-5760)

**Interfaces:**
- Consumes: `squarenessMarks(L).span` and `.degPerMm` from Task 1, for the printed conversion.
- Produces: no new exports.

- [ ] **Step 1: Rewrite step 3 and add a step 4 for squareness**

Step 3 currently measures only the top-left cross. Change it to all four, against their nearest edges, and add the squareness reading: the two top crosses' distances to the top edge, their difference, and the angle via `degPerMm.x`. Print the live numbers for the current page, e.g. `259.4 mm apart — 1 mm of difference is 0.22°`. Keep the existing offset arithmetic for the top-left cross unchanged. Renumber the following step.

- [ ] **Step 2: Add the three things the copy must say**

In the sheet's existing voice — short, plain, full sentences, no jargon:
  (a) the even/tapering white band between the margin line and the paper edge is the at-a-glance check, and no tools are needed for it;
  (b) **skew is not correctable in software** — the scale and offset settings move and resize the print but cannot rotate it — so an uneven band means either the printer is feeding crooked or the stock is cut off square;
  (c) the blank-sheet diagonal check that separates those two: both diagonals of a true 279.4 × 215.9 sheet read 353.1 mm, and 0.35° out of square shows as about 2.1 mm of difference.
  Also state that a missing margin line means the printer's non-printable margin is wider than 6 mm, not that the sheet printed wrong (Review Focus 4).
  Keep step 3 after the existing "once A and B read 100.0 mm" gate, so the 10 mm claims are only made at unity scale (Review Focus 3).

- [ ] **Step 3: Run the checks**

Run: `python3 -m py_compile proxy-press-server.py && node tools/console-check.js --probe tools/squareness-probe.js`
Expected: `py_compile` silent, `probe: true`, `PASS`

- [ ] **Step 4: Read the rendered sheet**

Export and rasterise as in Task 2 Step 5, in both orientations and on at least one small page size. Confirm the instruction block still fits the sheet and has not overflowed its `pdfText` width, and that the printed angle matches `degPerMm` for that page.

- [ ] **Step 5: Commit**

```bash
git add proxy-press.html
git commit -m "Alignment sheet: read all four corners, and what an uneven margin means"
```
