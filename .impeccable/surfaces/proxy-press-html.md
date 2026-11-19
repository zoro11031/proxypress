---
version: 1
slug: "proxy-press-html"
primary_target: "proxy-press.html"
related_targets: []
---

# Surface: Proxy Press workspace (proxy-press.html)

Mode: Operate. Whole-app redesign of the visual world, plus two workflow fixes (double-faced cards no longer silently switch to duplex; one name per setting across job ticket, Settings and export summary). Order prints sits on the same mat.

Out of scope: card-maker rendering, PDF/cut/order output, layout and calibration maths, the server.

## Direction contract

THESIS: The sheet lies on a graphite cutting mat; the deck reads as a tournament decklist and the settings as a job ticket. It refuses the dark-SaaS kit: lavender accent, glass bars, glows, nested bordered panels, eyebrow labels, side-stripe callouts.

OWN-WORLD: Graphite mat #1c2022 with a 1 mm / 10 mm grid and ruler edges carrying mm numerals; rails one step lighter; hairline rules #3a4246; text #e9eef0. Process cyan is the single live colour: selection, focus, primary action, cut lines. Paper stays #f5f6f2. System sans in three sizes, system mono for every number. Crop-mark corners mark selection. Everything lies flat on the mat; only dialogs lift.

STORY: Paste a list, see it ruled as a decklist with a double-ruled total. Watch the cards land on the sheet, which lies on the mat. Read the job ticket. Anything the app changed for you stays in cyan until you accept it. Review export, then print at 100%.

FIRST VIEWPORT: 48px header (name, Print at home / Order prints, deck select, mono count). Left 300px decklist: Qty | Card | set code, totals under a double rule. Centre: mat with top and left rulers; sheet controls under the ruler; sheet at fit scale with mm dimensions beneath it. Right 300px job ticket, mono values. 52px footer: job summary on the left, Print settings and the cyan Review export on the right.

FORM: Cutting Mat & Decklist, grounded list position 3 (assigned), pinned material: user's cutting-mat choice. seed:4c5d9638136d11d3

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
