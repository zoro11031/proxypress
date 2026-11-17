# Order gallery verification

Only the Order prints experience changed. Print setup/proof/export geometry remains intact.

- One shared-back prompt counts positive single-faced copies. It opens the existing picker directly, shows the selected back with Change/Clear, and disappears for orders with only individual backs. Shared-back absence does not flag card rows or inflate Needs attention.
- Gallery Front/Back replaces the old extra-back-image display. Each physical copy keeps one fixed-aspect tile; single-faced backs use the shared image and DFCs use their own reverse. Missing individual faces retain card-specific correction controls.
- Density and available width determine fixed grid tracks. Partial rows stay aligned, small orders do not stretch, and scrollbar space is reserved to prevent width jumps. Thumbnails are deduplicated per source within each render. Review order stays in the persistent footer.
- Order-only controls omit home alignment and Setup. The queue retains names, printing metadata, quantity inputs, warning text and actions. Selection survives side changes; keyboard selection and picker scope remain available.
- Download full order (ZIP) and Download order file (XML) open explicit format-specific confirmation. Stock, finish, included count and omissions come from captured order data. XML explains excluded uploads and an uploaded shared back. Confirmation exports that same snapshot. Existing ZIP/XML slot mapping and uploaded-byte behavior are retained.

## Executed checks

All successful browser runs reported `app loaded: yes`, `probe: true`, zero findings, and the harness self-test PASS.

```
node tools/console-check.js --offline-fixtures --probe tools/order-gallery-probe.js --width 1440 --height 900 --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/order-gallery-probe.js --width 390 --height 844 --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/order-gallery-probe.js --width 320 --height 740 --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/order-snapshot-probe.js --deadline 120
node tools/console-check.js --offline-fixtures --probe tools/workflow-probe.js --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/selection-probe.js --deadline 120
node tools/console-check.js --offline-fixtures --probe tools/navigation-probe.js --width 1024 --height 768 --deadline 120
git diff --check
```

These passed. The new fixture exercises empty, one-copy, mixed-face and 101-copy orders; singular/plural prompt counts; zero row warnings for a missing shared back; direct picker opening; choosing an uploaded back through the existing file handler; clearing; a genuine DFC back warning; equal tile widths and partial-row alignment; keyboard selection; selection across sides; and both reviewed downloads. ZIP bytes are inspected for the reviewed stock/finish/quantity, while XML is checked after changing current project data. Provider calls are stubbed for repeatability.

The first run exposed an existing null-cardback picker error, now guarded. Visual review also found a shrinking gallery wrapper; its width and regression assertions were corrected. Earlier interrupted runs without verdicts were inconclusive and were rerun.

[Desktop](desktop.png) and [phone](phone.png) captures were opened and inspected. Reproduce with `node tools/capture-workspace.js --state order --width 1440 --height 900 --output out/order-gallery-1440.png` (or 390×844). Source preview images are local fixtures. Desktop and phone cases were added to the regression runner. No remote CI, physical phone, or service availability claim is made.
