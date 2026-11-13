# Alignment sheet: measuring squareness — design

Date: 2026-11-12. Size: small change (one generator function plus its instructions).

## Intent and why

The user's prints come out rotated relative to the paper edge: about 1/16 in
(1.588 mm) of difference between the far left and far right of a landscape
sheet, which over the 259.4 mm between the alignment sheet's corner crosses is
a skew of **0.351°**. The front page is the one skewed, against the paper edge,
so this is not a duplex problem.

The alignment sheet already prints four corner crosses 10 mm in from both
edges, but step 3 of its instructions only ever asks for the top-left one. The
other three are drawn and ignored. Reading all four is what turns the existing
sheet into a squareness gauge, and the sheet should make that reading easy
rather than leaving it to a steel rule and mental arithmetic.

## Goals

- Read skew off one printed sheet, at the corners, with the scale right there.
- Make a tapering margin visible at a glance, before any measuring.
- Put the arithmetic on the sheet, so the number is usable in hand.
- Keep the sheet readable: it already carries A/B scale bars, four crosses, a
  card outline and four numbered steps.

## Non-goals and anti-goals

- **Not** correcting skew. Proxy Press has no fractional-degree rotation:
  `backOffsetX/Y` translate, `backScaleX/Y` scale about the centre, and
  `cardRotation`/`faceRot` are 0/90/180° layout rotations. Adding rotation
  correction is a separate decision and is not in scope here.
- **Not** poke holes. They transfer a point through the sheet, which is the
  right instrument for front-to-back registration and the wrong one for
  front-versus-paper-edge, where the mark is already on the side being read.
- **Anti-goal:** a sheet so crowded that the existing scale and offset steps
  get harder to follow. If it comes to that, the squareness gauge moves to its
  own sheet.

## Constraints

- **5 mm non-printable margin** on this engine (canon-suite's `cli.py` exists
  partly to drop it via an expanded-print-region PPD). Nothing can be imaged in
  the outer 5 mm, so no printed feature can reach or cross the paper edge.
- Drawing goes through `makeT(L, false)`, so everything inherits the printer
  scale and offset already set; the gauge must read correctly under non-unity
  scale.
- Must work in both orientations and on every page size in `PAGE_SIZES`.
- jsPDF only. No new dependencies, single file, strict CSP.

## Approaches

**A — Numbered corner scales.** Graduated scales perpendicular to each edge at
each corner, numbered in absolute mm from the nominal edge, 5 mm to 15 mm.
Still needs a rule, but removes the arithmetic and gives a precise target.
Resolution about 0.25 mm against a cut edge.

**B — Tapered vernier wedges.** Read where the paper edge crosses a 1:20 wedge,
no rule, ~0.05 mm. **Rejected: geometrically impossible.** The wedge lives
inside the printable area and the paper edge is always at least 5 mm outside
it, so the two never intersect. A straightedge laid along the paper edge sits
at 0 mm and does not cross the wedge either.

**C — Chosen.** A margin line plus corner scales plus on-sheet arithmetic.
Skew is a *difference* between two corners, not an absolute distance, and a
difference can be made visible without being measured:

1. **A fine line parallel to each edge**, inset 6 mm, running between that
   edge's two corner crosses. The white band between the line and the paper
   edge is constant when the print is square and visibly tapered when it is
   not. This is the at-a-glance check and needs no tools.
2. **Per corner, two graduated scales**, one perpendicular to each adjacent
   edge, spanning 5–15 mm from the nominal edge, ticks every 0.5 mm, labelled
   at 5 / 10 / 15. These are the precise targets for a rule when a number is
   wanted.
3. **On-sheet arithmetic.** The sheet prints the corner span for the current
   page and orientation and converts a difference to an angle, e.g. for
   landscape Letter: 259.4 mm span, 1 mm difference = 0.221°.

## Decisions taken here

- **It extends the existing alignment sheet** (`btnCal`), not a new sheet. The
  four corners are nearly empty — only a small cross each — and the sheet's job
  is already "is the print placed correctly on the paper", which is the same
  question. The crowding risk is the instruction text, not the geometry.
  My call, since the user did not pick; revisit if the text gets unreadable.
- The existing crosses stay where they are and keep their current role.
- The sheet states plainly that skew is not correctable in software, and names
  the two causes worth separating: a feed problem, or stock cut off square.
- A blank-sheet diagonal check goes in the instructions: both diagonals of a
  true 279.4 × 215.9 sheet read 353.1 mm, and 0.35° out of square shows as a
  2.1 mm difference between them. This distinguishes a crooked printer from
  crooked paper, and costs nothing to print.

## Left to the builder

- Exact tick lengths, label sizes and where the arithmetic block sits, within
  the sheet's existing typographic style.
- Whether the margin line is solid or dashed, and its weight, so that it reads
  against both plain paper and black-core stock.
- Whether the 5–15 mm scale span needs widening for page sizes where the
  printer offset is already large.
