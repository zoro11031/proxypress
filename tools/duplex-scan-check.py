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
from PIL import Image, ImageDraw
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
    ap.add_argument('--bleed', type=float, help='bleed, mm (plain and short layouts)')
    ap.add_argument('--calibrated', action='store_true', help='start from back settings that are already non-zero')
    a = ap.parse_args()
    g = dict(dx=0.8, dy=-0.55, rot=0.3, sx=1.0015, sy=0.999)
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
        img = Image.fromarray(printed.clip(0, 255).astype(np.uint8)); d = ImageDraw.Draw(img); truth = {}
        for p in sheet['pts']:
            hx, hy, rad = p['hole']['x'], p['hole']['y'], 0.35 * k
            d.ellipse([hx * k - rad, hy * k - rad, hx * k + rad, hy * k + rad], fill=(10, 10, 10))
            # The truth is the grid reading under the hole: the q with G(mark(q)) = hole,
            # where mark() is the back's affine drawing of its grid.
            m0 = np.array(G(p['mark']['x'], p['mark']['y']))
            J = np.array([np.array(G(p['jx']['x'], p['jx']['y'])) - m0, np.array(G(p['jy']['x'], p['jy']['y'])) - m0]).T
            q = np.linalg.solve(J, np.array([hx, hy]) - m0); truth[p['id']] = (f2 * q[0], f2 * q[1])
        P = np.asarray(img).astype(np.float32); pad = int(8 * k); H2, W2 = h + 2 * pad, w + 2 * pad
        YY, XX = np.mgrid[0:H2, 0:W2].astype(np.float32); th, s = math.radians(a.skew), 1.004
        X0 = XX - pad + a.bow * k * np.sin(math.pi * (YY - pad) / h); Y0 = YY - pad
        u, v = (X0 - w / 2) / s, (Y0 - h / 2) / s
        scan = np.stack([ndimage.map_coordinates(P[..., c], [h / 2 - u * math.sin(th) + v * math.cos(th), w / 2 + u * math.cos(th) + v * math.sin(th)],
                                                 order=1, cval=255) for c in range(3)], -1)
        out = os.path.join(tmp, 'scan.png'); Image.fromarray(scan.clip(0, 255).astype(np.uint8)).save(out)
        data = base64.b64encode(open(out, 'rb').read()).decode()
        res = run_probe(f"""(async () => {{ S.settings = {LAYOUTS[a.layout]}; const L = layout();
          const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,{data}')).blob());
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const g = c.getContext('2d', {{willReadFrequently: true}}); g.drawImage(bmp, 0, 0);
          const res = readDuplexScan(g.getImageData(0, 0, c.width, c.height), L, S.settings);
          const fit = res.error ? null : solveDuplexReadings(L, S.settings, res.readings);
          window.__probeArtifacts = {{res, fit}}; return true; }})();""", tmp, '600')
    rr, fit = res['res'], res['fit']
    if rr.get('error'): sys.exit('reader: ' + rr['error'])
    if os.environ.get("DEBUG"): [print(x, truth[x["id"]]) for x in rr["readings"]]
    errs = {x["id"]: math.hypot(x['x'] - truth[x['id']][0], x['y'] - truth[x['id']][1]) for x in rr['readings']}
    worst = max(errs, key=errs.get)
    print(f"{a.layout} at {a.dpi} dpi, scan turned {a.skew} deg and bowed {a.bow} mm: read {len(rr['readings'])} of {len(truth)} points "
          f"(scan dpi seen as {rr['dpi']:.0f}); worst error {errs[worst]:.3f} mm at {worst}")
    if rr['missing']: print('missing:', ', '.join(rr['missing']))
    print('fit:', json.dumps(fit['values']), f"residual max {fit['max']:.3f} mm")
    # Sub-pixel, not sub-micron: 0.05 mm, or three quarters of a scan pixel if that is coarser.
    bar = max(0.05, 0.75 * 25.4 / a.dpi)
    ok = not rr['missing'] and errs[worst] < bar
    print('PASS' if ok else 'FAIL'); return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
