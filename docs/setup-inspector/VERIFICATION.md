# Print Setup inspector verification

The change is limited to the Print at home inspector and its development checks. Order gallery behavior and print/calibration calculations are retained.

## Structure and behavior

- The docked inspector shows compact Paper, Layout, Sides, Cut and calibration rows. Paper/Layout/Sides/Cut edit buttons and Printer & driver, Color & stock, and Calibration & test sheets entry points lead to the original controls.
- Detailed settings use a 460px panel beside the proof at widths of 1400px and above, a drawer up to 520px on smaller desktops/tablets, and the full mobile settings view. Header/footer measurements bound the drawer. Close returns to the compact inspector or prior mobile view, retaining sheet and side and restoring focus to the actual opener. Escape also closes settings.
- Existing controls are grouped into Paper & layout, Printer & driver, Color & stock, Cut & registration, and Calibration & test sheets. Specialty stock presets now live with color tuning, using the same preset handler. The original settings/calibration IDs and delegated handlers remain in place.
- The inspector owns vertical scrolling. Nested panels lose their decorative borders, backgrounds and padding. Grid/flex children can shrink; inspector form grids, profile lists and test-sheet actions are single-column. Long button, profile and printer labels wrap. Native printer selectors have the full model name repeated as readable text.
- Active profile, paper/orientation, duplex scope and calibration status appear first in calibration. New/Save/Delete use a dedicated action group. Saved-profile Delete actions occupy their own row instead of overlapping text. Manual offsets, scale, rotation, alignment overlay and all test-sheet/wizard controls remain accessible.
- Settings regeneration preserves inspector scroll and focused fields where applicable. Opening/closing task groups does not reset the proof sheet or side. Manual zoom is retained; Fit recalculates only in Fit mode.

## Checks performed

Every browser PASS included `app loaded: yes`, `probe: true`, zero findings and all harness channels proven live.

```
node tools/console-check.js --offline-fixtures --probe tools/setup-inspector-probe.js --width 1440 --height 900 --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/setup-inspector-probe.js --width 1024 --height 768 --deadline 150 --artifacts out/setup-inspector-tests.json
node tools/console-check.js --offline-fixtures --probe tools/setup-inspector-probe.js --width 820 --height 768 --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/setup-inspector-probe.js --width 390 --height 844 --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/setup-inspector-probe.js --width 720 --height 450 --scale 2 --deadline 150
```

These passed with all task groups and nested sections expanded, a long printer model name, and five long saved profile names. Assertions check the inspector's own `scrollWidth`, every rendered button's horizontal bounds with focus-ring clearance, access to the final calibration field above the footer, profile apply/save, orientation changes, sheet/side preservation and focus restoration. Both calibration PDF actions were exercised: alignment-sheet.pdf (one page) and double-sided-test.pdf (two pages).

Additional passing probes used `node tools/console-check.js --offline-fixtures --probe tools/NAME-probe.js --deadline 120` (150 for preflight): `workspace`, `wizard`, `settings`, `calprofile`, `calibration-provenance`, and `preflight-calibration`. Navigation passed at 1024 and 1440px. The Order gallery probe also passed at 390px, guarding the previous task against unintended changes. Legacy preset assertions now locate all inspector presets, including the relocated stock presets, rather than requiring their former container.

Actual browser key events were checked with:

```
node tools/console-check.js --offline-fixtures --probe tools/workspace-visual-probe.js --width 1440 --height 900 --keyboard-selector '#inspPaper' --keyboard-assert 'document.body.classList.contains("settings-open")' --keyboard-close Escape --deadline 120
```

This passed and restored focus to Paper. The initial harness attempt omitted Enter's text payload; that failed opening assertion was resolved in the development harness, not by adding an application key workaround.

An isolated negative test forced the test-sheet cluster to 700px/two columns. The new probe failed on inspector overflow, the three test-action bounds, and stacking. The working source was not mutated for this check.

PDFs captured from the real handlers were decoded under `out/setup-test-pdfs/` and rasterized using `pdftoppm -scale-to 1000 -png`. The alignment sheet and double-sided reverse were opened and inspected. Printer feed accuracy still requires physical printing.

`python3 -m py_compile proxy-press-server.py`, `node --check tools/overhaul-check.js`, and `git diff --check` passed. New laptop, phone and zoom cases were added to the browser regression runner; remote CI execution is not claimed.

## Rendered evidence

[Compact docked inspector](compact.png) · [Expanded desktop](expanded-desktop.png) · [Laptop drawer](drawer-laptop.png) · [Phone](phone.png) · [200% equivalent](zoom-equivalent.png)

All captures were opened for inspection. Reproduce detailed views with `node tools/capture-workspace.js --state setup --width 1024 --height 768 --output out/setup-inspector-1024.png`. The zoom fixture uses a 720×450 CSS viewport at device scale 2, equivalent in available CSS space to a 1440×900 window at 200%; it does not automate the browser's zoom menu. A physical phone was not used. Raw logs and PDFs remain in ignored `out/`.
