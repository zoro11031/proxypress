// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// The registration marks have to match what Silhouette Studio draws from a
// Card Maker cutting template, because that is what the cutter was taught to
// find. The numbers below were read out of Card Maker's own files: the
// .studio3 templates carry inset 10 mm and length 20 mm on every paper size,
// and assets/layouts.json gives thickness 1 mm with length clamped to 5-20.
(() => {
  const fails = [];
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const near = (name, got, want, tol = 0.01) => { if (!(Math.abs(got - want) <= tol)) fails.push(`${name}: got ${got} want ${want} +-${tol}`); };
  const saved = JSON.parse(JSON.stringify(S.settings));

  try {
    for (const paper of ['letter', 'a4']) for (const orientation of ['landscape', 'portrait']) {
      S.settings = {...DEFAULTS, pageSize: paper, orientation, silhouette: true, guides: 'none',
        ...cameoPaperLayout(orientation)};
      const L = layout(), s = S.settings, tag = `${paper}/${orientation}`;

      // The whole point of the fix: nothing is in the way of these arms, so
      // they get Silhouette's full default length rather than a stub.
      eq(`${tag} auto arm`, regArm(L), 20);
      eq(`${tag} marks clear`, regConflict(L), false);

      const m = regMarks(L), i = s.regInset, t = m.width;
      // Three-mark pattern: a 5 mm square in the top-left corner, sitting with
      // its corner on the inset, and four L arms over two corners.
      eq(`${tag} square count`, m.rects.length, 1);
      eq(`${tag} square`, m.rects[0].join(','), [i, i, 5, 5].join(','));
      eq(`${tag} arm count`, m.lines.length, 4);
      eq(`${tag} nothing bottom-right`, m.lines.some(([x, y]) => x > L.W / 2 && y > L.H / 2), false);

      // Each arm is shortened by half the line width so the two meet flush.
      const arm = 20 - t / 2;
      m.lines.forEach((ln, j) => {
        const [x1, y1, x2, y2] = ln;
        near(`${tag} arm ${j} length`, Math.hypot(x2 - x1, y2 - y1), arm);
      });

      // Arms must stay off the cards.
      const gx0 = L.x0, gx1 = L.x0 + L.gw, gy0 = L.y0, gy1 = L.y0 + L.gh;
      m.lines.forEach((ln, j) => {
        const [x1, y1, x2, y2] = ln;
        const hitX = Math.max(x1, x2) > gx0 - t / 2 && Math.min(x1, x2) < gx1 + t / 2;
        const hitY = Math.max(y1, y2) > gy0 - t / 2 && Math.min(y1, y2) < gy1 + t / 2;
        eq(`${tag} arm ${j} clear of cards`, hitX && hitY, false);
      });
    }

    // Four-mark pattern is an L in all four corners and no square.
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape', silhouette: true,
      guides: 'none', ...cameoPaperLayout('landscape'), regPattern: 4};
    {
      const m = regMarks(layout());
      eq('four-mark square count', m.rects.length, 0);
      eq('four-mark arm count', m.lines.length, 8);
    }

    // An explicit length still wins, and is still clamped to Silhouette's range.
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape', silhouette: true,
      guides: 'none', ...cameoPaperLayout('landscape'), regLen: 12};
    eq('explicit arm', regArm(layout()), 12);
    S.settings.regLen = 40;
    eq('arm clamped high', regArm(layout()), 20);
    S.settings.regLen = 2;
    eq('arm clamped low', regArm(layout()), 5);

    // A grid pushed out to the mark line must still shorten the arms, or the
    // fix would just be "always 20" with no obstruction test left.
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape', silhouette: true,
      guides: 'none', ...cameoPaperLayout('landscape'), regInset: 25, regLen: 0};
    {
      const L = layout(), arm = regArm(L);
      if (!(arm < 20)) fails.push(`obstructed arm: got ${arm}, expected shortening below 20`);
      if (!(arm >= 5)) fails.push(`obstructed arm: got ${arm}, below the 5 mm floor`);
    }
  } catch (e) {
    fails.push(`threw: ${e && e.message}`);
  } finally {
    S.settings = saved;
    try { renderAll(); } catch {}
  }
  return fails.length ? {failed: fails} : true;
})();
