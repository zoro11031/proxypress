#!/usr/bin/env python3
"""Closed-loop check of the double-sided test's scan reader, against a known answer.

1. Renders the double-sided test from the live page (tools/console-check.js).
2. "Prints" page 2 through a known printer error G (shift, turn, size) and
   punches a pin hole wherever a pin through the front point comes out.
3. "Scans" it: turned, scaled, offset and bowed, the way a sheet that does not
   lie flat on the glass comes out.
4. Runs readDuplexScan in the page on that image, and compares every reading
   with the truth, then fits the readings and reports the correction.

Needs gs, numpy, scipy and Pillow. Development tool; nothing ships it.

    tools/duplex-scan-check.py                     # Card Maker letter template, 600 dpi
    tools/duplex-scan-check.py --layout plain --dpi 300
    tools/duplex-scan-check.py --layout plain --bleed 1 --calibrated   # thin bleed, back already set
"""
import argparse, base64, json, math, os, subprocess, sys, tempfile

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYOUTS = {
    'scm': "cleanSettings({...DEFAULTS,pageSize:'letter',cardPreset:'mtg',...scmSettings({...DEFAULTS,pageSize:'letter',cardPreset:'mtg'},'standard')})",
    'plain': "({...DEFAULTS,pageSize:'letter',orientation:'portrait',duplexFlip:'long'})",
    'short': "({...DEFAULTS,pageSize:'a4',orientation:'landscape',duplexFlip:'short'})",
}


def run_probe(src, tmp, deadline='300'):
    probe, art = os.path.join(tmp, 'probe.js'), os.path.join(tmp, 'art.json')
    open(probe, 'w').write(src)
    if os.path.exists(art): os.remove(art)
    p = subprocess.run(['node', 'tools/console-check.js', '--offline-fixtures', '--probe', probe,
                        '--artifacts', art, '--deadline', deadline], cwd=ROOT, capture_output=True, text=True)
    if not os.path.exists(art):
        sys.exit('probe failed:\n' + p.stdout[-1500:])
    return json.load(open(art))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--layout', choices=sorted(LAYOUTS), default='scm')
    ap.add_argument('--dpi', type=int, default=600)
    ap.add_argument('--skew', type=float, default=1.5, help='scanner turn, degrees')
    ap.add_argument('--bow', type=float, default=0.4, help='bow across the sheet, mm')
    ap.add_argument('--dx', type=float, default=0.8, help="printer's shift of the back page across, mm")
    ap.add_argument('--dy', type=float, default=-0.55, help="printer's shift of the back page down, mm")
    ap.add_argument('--sx', type=float, default=1.0015, help="printer's size of the back page across")
    ap.add_argument('--sy', type=float, default=0.999, help="printer's size of the back page down")
    ap.add_argument('--rot', type=float, default=0.3, help="printer's turn of the back page, degrees")
    ap.add_argument('--bleed', type=float, help='bleed, mm (plain and short layouts)')
    ap.add_argument('--calibrated', action='store_true', help='start from back settings that are already non-zero')
    a = ap.parse_args()
    g = dict(dx=a.dx, dy=a.dy, rot=a.rot, sx=a.sx, sy=a.sy)
    with tempfile.TemporaryDirectory() as tmp:
        extra = {}
        if a.bleed is not None and a.layout != 'scm': extra['bleed'] = a.bleed
        # A back that has been calibrated once already: readings are in the grid's
        # own units, which the back's scale and turn now stretch and turn.
        if a.calibrated: extra.update(backRotate=0.6, backScaleX=100.25, backScaleY=99.8, backOffsetX=0.4, backOffsetY=-0.3)
        if extra: LAYOUTS[a.layout] = f"({{...{LAYOUTS[a.layout]}, ...{json.dumps(extra)}}})"
        sheet = run_probe(f"""(() => {{ S.settings = {LAYOUTS[a.layout]}; const L = layout(), s = S.settings;
          window.__probeArtifacts = {{pdf: duplexCardTestDoc(L, s).doc.output('datauristring'), f2: duplexReadSign(L), W: L.W, H: L.H,
            pts: duplexCardPoints(L, s).map(p => ({{id: p.id, mark: p.mark, hole: p.hole,
              jx: duplexMarkAt(L, s, {{x: p.pre.x + 1, y: p.pre.y}}), jy: duplexMarkAt(L, s, {{x: p.pre.x, y: p.pre.y + 1}})}}))}}; return true; }})();""", tmp)
        pdf = os.path.join(tmp, 'sheet.pdf'); open(pdf, 'wb').write(base64.b64decode(sheet['pdf'].split(',', 1)[1]))
        png = os.path.join(tmp, 'p2.png')
        subprocess.run(['gs', '-q', '-dNOPAUSE', '-dBATCH', '-sDEVICE=png16m', f'-r{a.dpi}', '-dFirstPage=2', '-dLastPage=2',
                        '-sOutputFile=' + png, pdf], check=True)
        k, W, H, f2 = a.dpi / 25.4, sheet['W'], sheet['H'], sheet['f2']
        page = np.asarray(Image.open(png).convert('RGB')).astype(np.float32); h, w = page.shape[:2]
        cx, cy, r = W / 2, H / 2, math.radians(g['rot'])

        def G(x, y):
            u, v = (x - cx) * g['sx'], (y - cy) * g['sy']
            return cx + u * math.cos(r) - v * math.sin(r) + g['dx'], cy + u * math.sin(r) + v * math.cos(r) + g['dy']
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        X, Y = xx / k - g['dx'] - cx, yy / k - g['dy'] - cy
        sx = cx + (X * math.cos(r) + Y * math.sin(r)) / g['sx']; sy = cy + (-X * math.sin(r) + Y * math.cos(r)) / g['sy']
        printed = np.stack([ndimage.map_coordinates(page[..., c], [sy * k, sx * k], order=1, cval=255) for c in range(3)], -1)
        truth = {}
        # Where the raster puts a point at m mm is m*k plus some sub-pixel offset that
        # depends on the renderer's pixel convention and the page's rounding. Measure
        # it on the printed dots, whose places are known, and draw the holes the same
        # way; guessing it put every hole up to a pixel off the print.
        lum = page @ np.array([0.299, 0.587, 0.114], np.float32); offs = []
        for p in sheet['pts']:
            m, jx, jy = (np.array([p[q]['x'], p[q]['y']]) for q in ('mark', 'jx', 'jy'))
            for sa, sb in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                e = (m + 5 * sa * (jx - m) + 5 * sb * (jy - m)) * k; w9 = int(0.9 * k) + 2
                ex, ey = int(round(e[0])), int(round(e[1])); win = lum[ey - w9:ey + w9 + 1, ex - w9:ex + w9 + 1]
                wy, wx = np.nonzero(win < 110)
                if len(wx) > 3: offs.append((ex - w9 + wx.mean() - e[0], ey - w9 + wy.mean() - e[1]))
        off = np.mean(offs, axis=0); print(f'raster offset measured on {len(offs)} dots: {off[0]:+.3f}, {off[1]:+.3f} px')
        # A hole lets through light in proportion to how much of each pixel it
        # covers, the way a scanner sees it: 8 x 8 samples a pixel. Drawn with
        # whole-pixel edges instead, its centre moved by up to half a pixel.
        ss = (np.arange(8) + 0.5) / 8 - 0.5
        for p in sheet['pts']:
            hx, hy, rad = p['hole']['x'], p['hole']['y'], 0.35 * k
            ox, oy = hx * k + off[0], hy * k + off[1]
            x0, y0 = int(ox - rad) - 1, int(oy - rad) - 1; n = int(2 * rad) + 4
            gy, gx = np.mgrid[0:n, 0:n].astype(np.float64)
            sx_, sy_ = (gx[..., None, None] + x0 + ss[None, None, None, :]), (gy[..., None, None] + y0 + ss[None, None, :, None])
            cov = (((sx_ - ox) ** 2 + (sy_ - oy) ** 2) <= rad * rad).mean(axis=(2, 3))
            patch = printed[y0:y0 + n, x0:x0 + n]
            patch[:] = patch * (1 - cov[..., None]) + 10 * cov[..., None]
            # The truth is the grid reading under the hole: the q with G(mark(q)) = hole,
            # where mark() is the back's affine drawing of its grid.
            m0 = np.array(G(p['mark']['x'], p['mark']['y']))
            J = np.array([np.array(G(p['jx']['x'], p['jx']['y'])) - m0, np.array(G(p['jy']['x'], p['jy']['y'])) - m0]).T
            q = np.linalg.solve(J, np.array([hx, hy]) - m0); truth[p['id']] = (f2 * q[0], f2 * q[1])
        # The scan canvas holds the whole turned sheet with 8 mm round it, at any skew.
        th, s, pad = math.radians(a.skew), 1.004, int(8 * k)
        W2 = int(s * (abs(w * math.cos(th)) + abs(h * math.sin(th)))) + 2 * pad
        H2 = int(s * (abs(w * math.sin(th)) + abs(h * math.cos(th)))) + 2 * pad
        P = printed.clip(0, 255).astype(np.float32)
        YY, XX = np.mgrid[0:H2, 0:W2].astype(np.float32)
        X0 = XX - W2 / 2 + a.bow * k * np.sin(math.pi * YY / H2); Y0 = YY - H2 / 2
        u, v = X0 / s, Y0 / s
        scan = np.stack([ndimage.map_coordinates(P[..., c], [h / 2 - u * math.sin(th) + v * math.cos(th), w / 2 + u * math.cos(th) + v * math.sin(th)],
                                                 order=1, cval=255) for c in range(3)], -1)
        out = os.path.join(tmp, 'scan.png'); Image.fromarray(scan.clip(0, 255).astype(np.uint8)).save(out)
        if os.environ.get('KEEP_SCAN'): Image.fromarray(scan.clip(0, 255).astype(np.uint8)).save(os.environ['KEEP_SCAN'])
        data = base64.b64encode(open(out, 'rb').read()).decode()
        res = run_probe(f"""(async () => {{ S.settings = {LAYOUTS[a.layout]}; const L = layout();
          const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,{data}')).blob());
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const g = c.getContext('2d', {{willReadFrequently: true}}); g.drawImage(bmp, 0, 0);
          const res = readDuplexScan(g.getImageData(0, 0, c.width, c.height), L, S.settings);
          const fit = res.error ? null : solveDuplexReadings(L, S.settings, res.readings);
          window.__probeArtifacts = {{res, fit}}; return true; }})();""", tmp, '600')
    rr, fit = res['res'], res['fit']
    if rr.get('error'):
        # Holes on the grids' black dots (at +-5, +-5 mm) break the squares the
        # reader is built on; no scan can be read then, and the reader must say so.
        on_dots = sum(1 for v in truth.values() if min(math.hypot(v[0] - sa * 5, v[1] - sb * 5) for sa in (-1, 1) for sb in (-1, 1)) < 1.2)
        print('reader: ' + rr['error'])
        if on_dots >= len(truth) / 2:
            print(f'{on_dots} of {len(truth)} holes sit on the dots: refused, as it should be'); print('PASS'); return 0
        print('FAIL'); return 1
    if os.environ.get("DEBUG"): [print(x, truth[x["id"]]) for x in rr["readings"]]
    if not rr['readings']:
        far = min(math.hypot(*truth[i]) for i in truth)
        print(f"{a.layout}: no holes read; the nearest hole is {far:.2f} mm from its grid")
        ok = far > 4.2; print('PASS (all beyond the 4.5 mm search)' if ok else 'FAIL'); return 0 if ok else 1
    errs = {x["id"]: math.hypot(x['x'] - truth[x['id']][0], x['y'] - truth[x['id']][1]) for x in rr['readings']}
    worst = max(errs, key=errs.get)
    print(f"{a.layout} at {a.dpi} dpi, back printed shifted {a.dx:+g}/{a.dy:+g} mm, turned {a.rot} deg, sized {a.sx:g}/{a.sy:g}, scan turned {a.skew} deg and bowed {a.bow} mm: read {len(rr['readings'])} of {len(truth)} points "
          f"(scan dpi seen as {rr['dpi']:.0f}); worst error {errs[worst]:.3f} mm at {worst}")
    # Within 4.5 mm of its grid's zero a hole is in clear space and must be read,
    # to the bar below. Further out the reader finds the back's common shift and
    # looks there, but a hole 6-8 mm out lands among the grid's dots and label:
    # it may be skipped, or brush a label, and is held to 0.25 mm. Truth is in grid mm.
    lost = [i for i in rr['missing'] if math.hypot(*truth[i]) < 4.2]
    if rr['missing']: print('missing:', ', '.join(f"{i} ({math.hypot(*truth[i]):.1f} mm off)" for i in rr['missing']))
    print('fit:', json.dumps(fit['values']), f"residual max {fit['max']:.3f} mm")
    # Sub-pixel, not sub-micron: 0.05 mm, or three quarters of a scan pixel if that is coarser.
    bar = max(0.05, 0.75 * 25.4 / a.dpi)
    far = {i for i in errs if math.hypot(*truth[i]) > 4.5}
    near_w = max((errs[i] for i in errs if i not in far), default=0); far_w = max((errs[i] for i in far), default=0)
    if far: print(f"{len(far)} holes more than 4.5 mm off: worst {far_w:.3f} mm; the rest worst {near_w:.3f} mm")
    # A first pass from a back that far off is corrected by the next sheet, which
    # reads in clear space; it has to be close, not exact.
    ok = not lost and near_w < bar and far_w < 0.25
    print('PASS' if ok else 'FAIL'); return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
