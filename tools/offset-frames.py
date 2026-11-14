#!/usr/bin/env python3
"""Read tools/orientation-offset-probe.js's artifacts and say what each offset did.

Development-only, standard library only. Measures the exported PDFs rather than
the app's own arithmetic: every image placement is read out of the page content
stream, matched to its baseline image by index, and reported as a signed
movement. No transform is fitted to the marks, because a fit would absorb the
sign error this is meant to catch.

    node tools/console-check.js --probe tools/orientation-offset-probe.js \
         --artifacts /tmp/offsets.json
    python3 tools/offset-frames.py /tmp/offsets.json
"""
import base64, json, re, sys, zlib

K = 72 / 25.4            # mm -> pt, the unit jsPDF was given


def streams(pdf):
    """Every inflatable stream in the file, in file order."""
    out = []
    for m in re.finditer(rb"stream\r?\n", pdf):
        start = m.end()
        end = pdf.find(b"endstream", start)
        if end < 0:
            continue
        body = pdf[start:end].rstrip(b"\r\n")
        try:
            out.append(zlib.decompress(body))
        except zlib.error:
            out.append(body)
    return out


def content_streams(pdf):
    return [s for s in streams(pdf) if b" cm" in s and b" Do" in s]


NUM = r"(-?\d+\.?\d*(?:e-?\d+)?)"
TOK = re.compile((r"(?:" + r"\s+".join([NUM] * 6) + r"\s+cm" r"|(q)|(Q)|/(\w+)\s+Do)").encode())


def mul(a, b):
    """PDF matrices, row-vector convention: point . a . b."""
    a0, a1, a2, a3, a4, a5 = a
    b0, b1, b2, b3, b4, b5 = b
    return (a0 * b0 + a1 * b2, a0 * b1 + a1 * b3,
            a2 * b0 + a3 * b2, a2 * b1 + a3 * b3,
            a4 * b0 + a5 * b2 + b4, a4 * b1 + a5 * b3 + b5)


def placements(stream, page_h_mm):
    """Each `Do` in the stream, as the image's unit-square corners in page mm."""
    ctm = (1, 0, 0, 1, 0, 0)
    stack, out = [], []
    for m in TOK.finditer(stream):
        if m.group(9):                                   # name Do
            def to_mm(u, v):
                x = ctm[0] * u + ctm[2] * v + ctm[4]
                y = ctm[1] * u + ctm[3] * v + ctm[5]
                return (x / K, page_h_mm - y / K)        # top-down page mm
            out.append({"name": m.group(9).decode(),
                        "corners": [to_mm(0, 0), to_mm(1, 0), to_mm(0, 1), to_mm(1, 1)]})
        elif m.group(7):                                 # q
            stack.append(ctm)
        elif m.group(8):                                 # Q
            ctm = stack.pop() if stack else (1, 0, 0, 1, 0, 0)
        else:
            ctm = mul(tuple(float(g) for g in m.groups()[:6]), ctm)
    return out


SEG = re.compile((r"(?:" + NUM + r"\s+" + NUM + r"\s+(m|l)"
                  r"|" + r"\s+".join([NUM] * 6) + r"\s+cm"
                  r"|(q)|(Q))").encode())


def segments(stream, page_h_mm):
    """Straight line segments in the stream, as pairs of points in page mm."""
    ctm = (1, 0, 0, 1, 0, 0)
    stack, cur, out = [], None, []
    for m in SEG.finditer(stream):
        if m.group(3):                                   # x y m|l
            u, v = float(m.group(1)), float(m.group(2))
            x = (ctm[0] * u + ctm[2] * v + ctm[4]) / K
            y = page_h_mm - (ctm[1] * u + ctm[3] * v + ctm[5]) / K
            if m.group(3) == b"m":
                cur = (x, y)
            elif cur:
                out.append((cur, (x, y)))
                cur = (x, y)
        elif m.group(10):                                # q
            stack.append(ctm)
        elif m.group(11):                                # Q
            ctm = stack.pop() if stack else (1, 0, 0, 1, 0, 0)
        elif m.group(4):
            ctm = mul(tuple(float(g) for g in m.groups()[3:9]), ctm)
    return out


def text(stream):
    """Every literal string drawn in the stream, joined."""
    return " ".join(m.group(1).decode("latin-1")
                    for m in re.finditer(rb"\((.*?)\)\s*Tj", stream, re.S))


def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def cross_centre(segs, nominal, arm=7.0, gap=2.6, reach=9.0, tol=0.3):
    """Where a corner cross's centre is drawn, from the arms themselves.

    pdfCross draws four arms of a known length that stop a known distance short
    of the centre. Each arm therefore gives the centre on its own: step `gap`
    past its inner tip, along the arm. Nothing is fitted; the spread between the
    arms is reported so a disagreement cannot hide in an average.
    """
    want = arm - gap
    ests = []
    for a, b in segs:
        if abs(dist(a, b) - want) > tol:
            continue
        inner, outer = (a, b) if dist(a, nominal) < dist(b, nominal) else (b, a)
        if dist(inner, nominal) > reach:
            continue
        L = dist(inner, outer) or 1
        ux, uy = (inner[0] - outer[0]) / L, (inner[1] - outer[1]) / L
        ests.append((inner[0] + gap * ux, inner[1] + gap * uy))
    if not ests:
        return None, 0, 0.0
    cx = sum(e[0] for e in ests) / len(ests)
    cy = sum(e[1] for e in ests) / len(ests)
    spread = max(max(abs(e[0] - cx), abs(e[1] - cy)) for e in ests)
    return (cx, cy), len(ests), spread


def anchor(p):
    """The centre of the drawn image, in page mm.

    A material point, not a bounding-box corner: under a rotation the corner of
    the box is not the same point on the card, which would contaminate both the
    movements and any angle read off two of them.
    """
    return (sum(c[0] for c in p["corners"]) / 4, sum(c[1] for c in p["corners"]) / 4)


def measure(run):
    pdf = base64.b64decode(run["pdf"])
    pages = content_streams(pdf)
    h = run["page"]["H"]
    return [[anchor(p) for p in placements(s, h)] for s in pages]


def sheet_frame(orientation):
    """page axes -> the sheet's own axes, (along feed, across feed).

    Measured, not assumed: the same PDF through cupsfilter with the Canon PPD,

        cupsfilter -m application/vnd.cups-raster -p ppd/CNRCUPSMF750ZS_FULL.ppd \
          -o "PageSize=Letter print-scaling=none orientation-requested=4" land.pdf

    puts a landscape page's top-left corner at the TOP RIGHT of the 9728x12728
    portrait raster and its top-right corner at the BOTTOM right: the page is
    turned 90 degrees clockwise and its LEFT edge leads. A portrait page with
    orientation-requested=3 is not turned at all, so its TOP edge leads.
    """
    if orientation == "portrait":
        return lambda dx, dy: (dx, dy)          # the page IS the raster
    return lambda dx, dy: (-dy, dx)             # page +x points down the raster


def through_sheet(flip, across, along):
    """A back-page move seen through the front of the sheet.

    The printer is handed the same portrait raster whichever way the page is
    turned, plus a binding edge. Long-edge binding mirrors that raster about its
    long (vertical) axis, so the across-feed component negates and the along-feed
    one does not; short-edge binding is the other way round.
    """
    return (-across, along) if flip == "long" else (across, -along)


def fmt(t):
    return "(" + ", ".join(f"{v:+.3f}" for v in t) + ")"


def main(path):
    art = json.load(open(path))
    runs = {r["label"]: r for r in art["runs"]}
    if art.get("notes"):
        print("probe notes:", art["notes"])
    flip = "long"

    for group in ("", "rot/"):
        for orientation in ("landscape", "portrait"):
            base = runs.get(f"{orientation}/{group}base")
            if not base:
                continue
            b = measure(base)
            to_sheet = sheet_frame(orientation)
            tag = "  with print rotation -0.21 / back rotation -0.62" if group else ""
            p = base["page"]
            print(f"\n=== {orientation}{tag}")
            print(f"    page {p['W']}x{p['H']}mm, grid {p['cols']}x{p['rows']}, duplex mirror "
                  f"{'X' if p['mirrorX'] else 'Y'}, {len(b)} pages, {[len(x) for x in b]} images")
            print(f"    {'+1.00 mm on':<15}{'front page':>18}{'back page':>18}"
                  f"{'front sheet':>20}{'back thru sheet':>20}{'back-front':>20}")
            for name in ("offsetX", "offsetY", "backOffsetX", "backOffsetY"):
                r = runs.get(f"{orientation}/{group}{name}+1")
                if not r:
                    continue
                v = measure(r)
                cells = []
                for pi in range(min(len(b), len(v))):
                    d = {(round(v[pi][i][0] - b[pi][i][0], 4), round(v[pi][i][1] - b[pi][i][1], 4))
                         for i in range(min(len(b[pi]), len(v[pi])))}
                    cells.append(next(iter(d)) if len(d) == 1 else ("varies", sorted(d)))
                fr = cells[0]
                bk = cells[1] if len(cells) > 1 else (0.0, 0.0)
                fs = to_sheet(*fr)
                bs = through_sheet(flip, *to_sheet(*bk))
                rel = (bs[0] - fs[0], bs[1] - fs[1])
                print(f"    {name:<15}{fmt(fr):>18}{fmt(bk):>18}{fmt(fs):>20}{fmt(bs):>20}{fmt(rel):>20}")
            print("    page columns are (x, y) mm; sheet columns are "
                  "(across feed, along feed) mm")
            # The two turns, read off the same bytes: the angle of the line from
            # slot 0 to slot 1, against the same line with both rotations at zero.
            if group:
                z = runs.get(f"{orientation}/base")
                if z:
                    zm, rm = measure(z), measure(base)
                    for pi, face in ((0, "front"), (1, "back")):
                        if len(zm) <= pi or len(zm[pi]) < 2:
                            continue
                        import math
                        def ang(rows):
                            a, b2 = to_sheet(*rows[pi][0]), to_sheet(*rows[pi][1])
                            return math.degrees(math.atan2(b2[1] - a[1], b2[0] - a[0]))
                        turned = ang(rm) - ang(zm)
                        seen = turned if face == "front" else -turned
                        print(f"    {face} grid turned {turned:+.3f} deg in the raster, "
                              f"{seen:+.3f} deg seen through the front of the sheet")

    # The calibration sheets against the card exporter, in the bytes.
    print("\n=== calibration sheets vs the card exporter (offsetX 1.00, offsetY 0.50, "
          "back -2.80/-2.20, rotations -0.21/-0.62)")
    for orientation in ("landscape", "portrait"):
        cards = runs.get(f"{orientation}/live/cards")
        align = runs.get(f"{orientation}/live/align")
        duplex = runs.get(f"{orientation}/live/duplex")
        if not (cards and align and duplex):
            continue
        print(f"\n  {orientation}")
        cm = measure(cards)
        for face, idx in (("front", 0), ("back", 1)):
            want = cards["predicted"]["front" if idx == 0 else "back"]
            got = cm[idx][0]
            d = (got[0] - want["x"], got[1] - want["y"])
            print(f"    card {face} slot 0 centre drawn at {fmt(got)}, transform says "
                  f"({want['x']:+.3f}, {want['y']:+.3f})  diff {fmt(d)}")
        apdf = base64.b64decode(align["pdf"])
        h = align["page"]["H"]
        segs = [sg for st in streams(apdf) if b" l\n" in st or b" l " in st
                for sg in segments(st, h)]
        nominal = [(10, 10), (align["page"]["W"] - 10, 10), (10, h - 10),
                   (align["page"]["W"] - 10, h - 10)]
        for i, nom in enumerate(nominal):
            c, n, spread = cross_centre(segs, nom)
            want = align["expect"]["crosses"][i]
            if c is None:
                print(f"    alignment cross {i}: no arms found near {nom}")
            else:
                print(f"    alignment cross {i} drawn at {fmt(c)} ({n} arms, spread "
                      f"{spread:.3f}), transform says ({want['x']:+.3f}, {want['y']:+.3f})"
                      f"  diff {fmt((c[0] - want['x'], c[1] - want['y']))}")
        akey = " ".join(text(st) for st in streams(apdf) if b"ALIGN KEY" in st)
        m = re.search(r"crosses ([-\d. ,]+?) \| dot", akey)
        if m:
            said = [tuple(float(v) for v in q.split(",")) for q in m.group(1).split()]
            worst = max(max(abs(a[0] - w["x"]), abs(a[1] - w["y"]))
                        for a, w in zip(said, align["expect"]["crosses"]))
            print(f"    ALIGN KEY crosses {m.group(1)}  -> worst disagreement with the "
                  f"transform {worst:.3f} mm")
        else:
            print(f"    ALIGN KEY not found in the sheet ({len(akey)} chars of text read)")
        dkey = " ".join(text(st) for st in streams(base64.b64decode(duplex["pdf"]))
                        if b"SCAN KEY" in st)
        for field in ("marks", "holes"):
            m = re.search(field + r" ([-\d. ,]+?)(?: \||$)", dkey)
            if not m:
                print(f"    SCAN KEY {field} not found")
                continue
            said = [tuple(float(v) for v in q.split(",")) for q in m.group(1).split()]
            worst = max(max(abs(a[0] - w["x"]), abs(a[1] - w["y"]))
                        for a, w in zip(said, duplex["expect"][field]))
            print(f"    SCAN KEY {field:<6} worst disagreement with duplexTestPoints "
                  f"{worst:.3f} mm")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/offsets.json")
