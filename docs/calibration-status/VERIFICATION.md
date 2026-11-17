# Calibration status verification

Print at home now derives Setup, Proof and Review from one side-specific calibration status. Numeric geometry helpers, transforms and PDF drawing were not changed.

## Status rules

- Valid alignment input applies immediately and records the affected side as **Manual alignment applied**, without requiring a named profile. Explicit zero is a recorded value, distinct from untouched defaults.
- Saving entered or already measured values records their current setup and immediately shows **Measured for this setup**. Front scope is printer, paper/dimensions and orientation. Back scope additionally includes duplex method and flip. Front and back are independent.
- Carried or rotated values show **Estimated alignment**. A side with neutral values and no applicable record shows **No correction set**. If switching duplex resets an unmeasured back to zero, its status reflects that cleared correction rather than claiming a measurement.
- Single-sided job summaries omit back status. The advanced back controls remain available. DFCs still count as duplex when shared backs are off.
- Wizard Apply records manual back alignment; Clear removes the back-offset correction and updates status. Named-profile save, apply, clear and deletion refresh the same presentation paths.
- Setup and Review show active offsets, scales and rotation. Proof shows the same side status, with the active values in its title. The badge also remains available at phone widths and has a polite status announcement.

## Data and review behavior

Additive `calibrationState` metadata is stored per project and validated on load, preserving explicit numeric zeros. Existing IndexedDB IDs/version and settings values are unchanged. Old scoped profile fields and duplex records remain usable; old unscoped/non-default values without reliable provenance remain estimated. New profile measurement flags do not control whether stored values are applied: duplex-slot availability and measurement status are deliberately separate.

The print/review key includes project provenance, selected profile ID and its record. Saving or changing a source invalidates stale async review even when the numeric settings are identical. Machine-specific provenance is removed from compact/shared deck files and their imports; full project storage/backups retain it.

## Acceptance and regression checks

Passing browser checks required app loaded, probe true, zero findings and all harness observation channels proven live.

```
node tools/console-check.js --offline-fixtures --probe tools/calibration-status-probe.js --artifacts out/calibration-status-pdfs.json --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/calibration-status-probe.js --width 390 --height 844 --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/calprofile-probe.js --deadline 120
node tools/console-check.js --offline-fixtures --probe tools/calibration-provenance-probe.js --deadline 120
node tools/console-check.js --offline-fixtures --probe tools/preflight-calibration-probe.js --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/duplex-roundtrip-probe.js --deadline 150
node tools/console-check.js --offline-fixtures --probe tools/job-snapshot-probe.js --deadline 120
node tools/console-check.js --offline-fixtures --probe tools/save-status-probe.js --deadline 120
node tools/console-check.js --offline-fixtures --probe tools/sheet-export-probe.js --deadline 150
git diff --check
python3 -m py_compile proxy-press-server.py
```

The acceptance probe passed with no profile selected: front X=1.2/Y=-0.7 mm, extra back X=2.25/Y=-3.5 mm, immediate manual confirmation on all surfaces, and exact PDF image displacement. Front PDF placement changed by (+1.2,-0.7) mm; the back changed by (+3.45,-4.2) mm because the existing geometry adds the extra back offsets to the common front offsets. Profile save changed provenance and review key without changing settings. A flip change preserved the front measurement; orientation fallback was estimated. Explicit zero measurements survived cleaning, durable save and reload. Wizard Apply/Clear and simplex summary omission were exercised.

An isolated copy of the old revision failed the new acceptance assertions, including immediate manual status, PDF input updates, save refresh, zero/reload handling, and source-only invalidation. One development iteration incorrectly reset stored unmeasured duplex values; the existing profile probe caught it. The resolver now retains its original slot-availability test, independent of measurement flags. The provenance probe's reset-back expectation was updated from Estimated to No correction set to reflect the actual zeroed values.

The PDF fixtures were decoded and rasterized with `pdftoppm -scale-to 1000 -png`; raw coordinates and generated files remain under ignored `out/calibration-status-pdf/`. Desktop and phone captures were opened for inspection: [desktop](desktop.png), [phone](phone.png). Reproduce using `node tools/capture-workspace.js --state calibration --width 1440 --height 900 --output out/calibration-status-desktop.png` or 390×844. The new status probe is included in the regression runner.

A previously interrupted sheet-export run without a verdict was inconclusive and excluded; the command was rerun. Remote CI and physical printer measurement are not claimed. No deployment or push is included.
