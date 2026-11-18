# Silhouette Studio base templates

These five `.studio3` files come from
[silhouette-card-maker](https://github.com/Alan-Cha/silhouette-card-maker)
(`cutting_templates/`), which is MIT licensed. They are used as base documents for Proxy Press's `.studio3` export.

They are here because Silhouette Studio's free Basic edition cannot import
SVG — it answers "The file type you are attempting to access is not
supported" — and a DXF carries only geometry, leaving the page size and the
registration-mark setup to be typed in by hand. A `.studio3` carries all of
it, and Studio opens it in every edition.

Proxy Press does not write a `.studio3` from nothing. The container holds
counters and byte offsets that are not understood, so the export rewrites the
card coordinates of an existing document **in place**: the file's length never
changes, and every field that was not decoded stays correct because nothing
moved. That is why the choice of base matters — it has to already hold exactly
as many cards as the sheet does.

| File | Paper | Cards | Used for |
|---|---|---|---|
| `letter-standard_double-v3.studio3` | Letter | 4 | Letter landscape, two by two or four occupied positions |
| `letter-standard-v6.studio3` | Letter | 8 | Letter landscape |
| `letter-catan-v2.studio3` | Letter | 9 | Letter portrait |
| `a4-standard-v5.studio3` | A4 | 8 | A4 landscape |
| `a4-bridge-v4.studio3` | A4 | 9 | A4 portrait |

Proxy Press resizes the card outlines to match the sheet. The stored arms are
8.0264 mm for Letter landscape, 14.3764 mm for Letter portrait Catan, 9.398 mm
for A4 landscape and 6.6802 mm for A4 portrait. Letter portrait MTG uses the
7.4422 mm arm from the Card Maker borderless standard layout. Auto can also
shorten arms to clear the cut paths. Use the paired DXF or SVG when the arm
differs from the native template. All four template pages use three marks and a nominal 10 mm inset
and 1 mm thickness. When the printed inset is smaller, the Studio canvas and
cut coordinates include padding around the physical sheet. For other mark
settings or a separate cutter orientation, use DXF and follow the setup
shown in Review export.

The four-card base adapts Card Maker’s standard_double file. Both copies of the page setup use the Letter landscape values from letter-standard-v6. Each shape also stores a vertical translation tied to the original page height. The four translations use the landscape values. Leaving the portrait translations in place moved the trim down 63.5 mm in Windows Studio. The operator confirmed the corrected four-card job cut successfully on November 17, 2026.
