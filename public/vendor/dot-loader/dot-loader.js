/* Vendored from RENDRlabworks/defacto-components@c22cc96 (main), components/dot-loader. Edit there, then copy here. */
/* <dot-loader> · Defacto
   A bare 9 by 9 grid of square cells that waits, fills and finishes. Ten patterns, the
   same ones as the loader-* cards, with no card around them.

   Use:
     <link rel="stylesheet" href="kit/tokens.css">   (loaded for you if missing)
     <script src="components/dot-loader/dot-loader.js"></script>
     <dot-loader pattern="tide" value="36"></dot-loader>

   Attributes
     pattern="tide | bloom | zipper | scatter | stack | dial | halftone | grow | checker | knight"
                      Defaults to tide.
     value="0..100"   Progress. Leave it off while the size is unknown and the grid plays its
                      waiting motion. Cells fill as it rises; at 100 a bright pass runs through
                      the fill. Lower it and the cells past it drain back to rest.
     loop             Ignore value and play the demo loop: wait, fill to 100, finish, drain,
                      once every 9 seconds. Every looping loader on a page stays in step.
     label="..."      Accessible name. Defaults to "Loading".
     fill             Cover the element's whole box with cells at the 140px size (12px cells on a
                      16px pitch) instead of scaling nine of them. The grid grows to fit, centred,
                      and the pattern grows with it: smooth patterns stretch, stepwise ones (stack,
                      grow, checker, knight, zipper) move in blocks of cells. Give the element a
                      width and height; below 140px it falls back to nine cells that fit.
   Size
     140px square by default. Set a width in CSS and the cells scale with it: the grid is 35
     units across, each cell 3 units and each gap 1. Multiples of 35px stay crisp. With fill,
     the cell size is fixed and the box sets how many cells there are.
   Properties
     value            Mirrors the attribute: a number, or null while waiting.
     pattern          Mirrors the attribute.
     progress         Read only. What the grid shows now, 0 to 100, or null while waiting.
     columns, rows    Read only. The grid's size in cells: 9 by 9, or what fill fits in the box.
   Methods
     draw(ms)         Paint one frame at page time ms. The demo page's recorder uses it.
   Events (bubble out of the element)
     dot-loader-complete   The fill reached 100.
*/
(function () {
  const TAG = 'dot-loader';
  const SRC = (document.currentScript && document.currentScript.src) || location.href;
  const url = (p) => new URL(p, SRC).href;

  // The kit's tokens live on the document; the element reads them through inheritance.
  function ensureTokens() {
    if (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) return;
    if (document.querySelector('link[data-nk-tokens]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url('../../kit/tokens.css');
    l.setAttribute('data-nk-tokens', '');
    document.head.appendChild(l);
  }

  /* Shared ------------------------------------------------------------- */
  const N = 9, REST = 1 / 3, TAU = Math.PI * 2;
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (x) => x * x * (3 - 2 * x);
  const backOut = (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
  const tier = (i) => (i > 0.85 ? 0 : i > 0.62 ? 1 : i > 0.45 ? 2 : i > 0.3 ? 3 : 4);
  const STILL = matchMedia('(prefers-reduced-motion: reduce)');

  // The demo loop: wait for a size, run to 100%, hold, drain, start again.
  const LOOP = 9, RUN0 = 1.8, RUN1 = 7.0, DRAIN0 = 8.1, DRAIN1 = 8.8;

  /* Patterns ----------------------------------------------------------- */
  // Each pattern is made for a grid G of W by H cells. It gives every cell a key
  // (lower fills first) and an idle motion, in 0..1 per cell, for while the size is
  // unknown. Optional hooks:
  //   run(c, F, o)   draw the fill itself from progress F.p instead of by key
  //   post(c, F, o)  draw over the fill
  //   frame(t)       once per frame, before the cells
  //   extra(F)       draw shapes between cells after the grid
  //   group(c)       cells with the same group fill together
  //   delay          seconds between a cell's turn and when it shows
  // c holds x, y, dx and dy from the center, r, th (clockwise from twelve), and mx, my:
  // its block when the grid is larger than 9 by 9.
  // G holds W, H, the center cx and cy, S (how many cells stand in for one cell of the
  // 9 by 9 design, so shapes keep their proportions) and k (S rounded: the block size
  // that the stepwise patterns move in). On a 9 by 9 grid S and k are 1 and every
  // pattern is exactly the original.
  const PATTERNS = {};

  // Tide. The level rises from the bottom row and its surface rolls, so the top
  // cells sit part full. While waiting, a low swell runs along the floor.
  PATTERNS.tide = (G) => ({
    seed: 1,
    key: (c) => (G.H - 1 - c.y) * 10000 + c.x,
    run(c, F, o) {
      const p = F.p, A = 0.7 * G.S * Math.sqrt(Math.sin(Math.PI * p));
      const surf = p * (G.H + 0.4) - 0.2 + A * (Math.sin((c.x * 0.85) / G.S - F.t * 3.4) * 0.75 + Math.sin((c.x * 1.9) / G.S + F.t * 2.2) * 0.25);
      const depth = surf - (G.H - 1 - c.y), v = clamp01(depth);
      if (v <= 0) return;
      o.s = REST + (1 - REST) * v;
      o.c = F.still ? 2 : depth < 1.3 * G.S ? 0 : depth < 2.4 * G.S ? 1 : 2;
    },
    idle(c, t) {
      const surf = G.S * (1.15 + 0.85 * Math.sin((c.x * 0.75) / G.S - t * 3.6) + 0.35 * Math.sin((c.x * 1.9) / G.S + t * 2.3));
      const depth = surf - (G.H - 1 - c.y);
      return depth <= 0 ? 0 : depth < 1.2 ? clamp01(depth) : 0.7;
    }
  });

  // Bloom. Cells open in four twisted petals from the center out. While waiting,
  // the petals turn and a pulse breathes out from the middle.
  PATTERNS.bloom = (G) => ({
    seed: 2,
    key: (c) => { const r = c.r / G.S; return r / (1 + 0.34 * Math.cos(4 * c.th + 0.4 * r)) + c.th * 0.0001; },
    idle(c, t) {
      const r = c.r / G.S;
      if (r < 0.5) return 0.75 + 0.25 * Math.sin(t * 6);
      if (r > 4.4) return 0;
      const petal = 0.5 + 0.5 * Math.cos(4 * c.th - t * 2.6 + r * 0.55);
      const pulse = 0.5 + 0.5 * Math.sin(t * 4.5 - r * 1.4);
      return petal * petal * (0.3 + 0.7 * pulse);
    }
  });

  // Zipper. Even columns fill from the top, odd columns from the bottom, level by
  // level, so the halves close on each other like teeth. While waiting, the pull
  // runs up and down and opens the teeth around it. On larger grids a tooth is k
  // columns wide.
  PATTERNS.zipper = (G) => ({
    seed: 3,
    key: (c) => (c.mx % 2 ? G.H - 1 - c.y : c.y) * G.W + c.x * 0.1,
    idle(c, t) {
      const yp = G.cy + 0.85 * G.cy * Math.sin(t * 2.4);
      if (Math.abs(c.y - yp) < 0.5 * G.k && Math.abs(c.x - G.cx) <= G.k) return 1;
      const d = c.mx % 2 ? c.y - yp : yp - c.y;
      return d > 0 && d < 2.8 * G.S ? 0.85 * (1 - d / (2.8 * G.S)) : 0;
    }
  });

  // Scatter. Cells land in a random order, each one a size too large before it
  // settles. While waiting, cells spark at random and fade.
  PATTERNS.scatter = () => ({
    seed: 4,
    key: (c) => hash(c.x * 3.1 + 0.7, c.y * 7.7 + 1.3),
    idle(c, t) {
      const ph = t * 4.6 + c.h * 9, tick = Math.floor(ph);
      if (hash(c.h * 13.1, tick) < 0.84) return 0;
      const f = 1 - (ph - tick);
      return f * f;
    }
  });

  // Stack. The grid is cut into blocks of one to four cells, packed bottom up.
  // Each block falls in from above when its turn comes and locks into place.
  // While waiting, one block at a time drops through the empty grid. On larger
  // grids every cell of a block is k by k cells.
  PATTERNS.stack = (G) => {
    const FALL = 0.32, k = G.k, Wm = G.Wm, Hm = G.Hm;
    const SHAPES = [
      [[0, 0], [1, 0], [0, -1], [1, -1]],
      [[0, 0], [1, 0]],
      [[0, 0], [0, -1]],
      [[0, 0], [1, 0], [2, 0]],
      [[0, 0], [0, -1], [0, -2]]
    ];
    const own = Array.from({ length: Hm }, () => Array(Wm).fill(-1));
    const pieces = [];
    let s = 0;
    for (let y = Hm - 1; y >= 0; y--) {
      for (let x = 0; x < Wm; x++) {
        if (own[y][x] >= 0) continue;
        const fits = SHAPES.filter((sh) => sh.every(([dx, dy]) => x + dx < Wm && y + dy >= 0 && own[y + dy][x + dx] < 0));
        const sh = fits.length ? fits[Math.floor(hash(++s * 1.37, 5.1) * fits.length)] : [[0, 0]];
        const cells = sh.map(([dx, dy]) => [x + dx, y + dy]);
        cells.forEach(([X, Y]) => { own[Y][X] = pieces.length; });
        const [fx, fy] = cells[0];
        pieces.push({ cells, first: Math.min(fy * k, G.H - 1) * G.W + Math.min(fx * k, G.W - 1), top: Math.min(...cells.map((q) => q[1])) });
      }
    }
    // One block cell, drawn as k by k grid cells at block position (X, Y).
    const block = (F, X, Y, ci, a) => {
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        const x = X * k + i, y = Y * k + j;
        if (x < G.W && y < G.H) F.paint(x, y, 1, ci, a);
      }
    };
    return {
      seed: 5,
      delay: FALL,
      key: (c) => own[c.my][c.mx],
      group: (c) => own[c.my][c.mx],
      extra(F) {
        if (F.still) return;
        // Blocks in flight.
        for (const pc of pieces) {
          const at = F.at(pc.first);
          if (at == null) continue;
          const f = (F.t - at) / FALL;
          if (f < 0 || f >= 1) continue;
          const off = (1 - f * f) * (pc.top + 2);
          for (const [x, y] of pc.cells) block(F, x, y - off, 0, 1);
        }
        // While waiting: one block drops through, lands on the floor and fades.
        if (F.env > 0) {
          const n = Math.floor(F.t / 0.55), f = (F.t / 0.55) % 1;
          const sh = SHAPES[Math.floor(hash(n, 1.1) * SHAPES.length)];
          const w = Math.max(...sh.map((q) => q[0])) + 1;
          const x0 = Math.floor(hash(n, 2.3) * (Wm - w + 1));
          const y = -1 + Math.min(1, f / 0.62) ** 2 * Hm;
          const a = F.env * (f > 0.62 ? 1 - (f - 0.62) / 0.38 : 1);
          for (const [dx, dy] of sh) block(F, x0 + dx, y + dy - 1, f > 0.62 ? 1 : 0, a);
        }
      }
    };
  };

  // Dial. A hand turns clockwise from twelve and the grid fills behind it like a
  // pie. While waiting, the hand spins fast and leaves a fading trail.
  PATTERNS.dial = (G) => ({
    seed: 6,
    key: (c) => (c.r / G.S < 0.5 ? -1 : c.th + c.r * 0.001),
    post(c, F, o) {
      if (!F.hand) return;
      const r = c.r / G.S;
      if (r < 0.5) { o.s = 1; o.c = 0; return; }
      const a = F.p * TAU;
      let d = Math.abs(c.th - a); d = Math.min(d, TAU - d);
      if (d < 0.42 / Math.max(r, 1) && r < 4.7) { o.s = Math.max(o.s, 1); o.c = 0; }
    },
    idle(c, t) {
      const r = c.r / G.S;
      if (r < 0.5) return 1;
      if (r > 4.6) return 0;
      const behind = (((t * TAU) / 1.1 - c.th) % TAU + TAU) % TAU;
      return Math.exp(-behind * 1.5);
    }
  });

  // Halftone. Cells swell from a dot to full size along a soft diagonal front, so
  // the fill reads as a halftone gradient sliding across. While waiting, a
  // halftone wave turns around the center.
  PATTERNS.halftone = (G) => {
    const span = G.W + G.H - 2;
    return {
      seed: 7,
      key: (c) => (c.x + c.y) / span + c.x * 0.00001,
      run(c, F, o) {
        const v = clamp01((F.p * 1.45 - (c.x + c.y) / span) / 0.45);
        if (v <= 0) return;
        o.s = REST + (1 - REST) * v;
        o.c = v > 0.999 || F.still ? 2 : v > 0.7 ? 0 : v > 0.4 ? 1 : 3;
      },
      idle(c, t) {
        const a = t * 1.4;
        const proj = (c.dx * Math.cos(a) + c.dy * Math.sin(a)) / (5.66 * G.S);
        return Math.pow(0.5 + 0.5 * Math.sin(proj * 4.6 - t * 5.5), 1.6);
      }
    };
  };

  // Grow. The fill spreads from one seed cell to random neighbors, like a colony.
  // While waiting, a glider from the Game of Life crawls across the grid. On larger
  // grids both work in k by k blocks.
  PATTERNS.grow = (G) => {
    const Wm = G.Wm, Hm = G.Hm;
    const rank = Array.from({ length: Hm }, () => Array(Wm).fill(-1));
    const front = [[Math.floor((2 * Wm) / 9), Math.floor((6 * Hm) / 9)]];
    let n = 0;
    while (front.length) {
      const [x, y] = front.splice(Math.floor(hash(n * 1.91 + 0.3, 8.8) * front.length), 1)[0];
      if (rank[y][x] >= 0) continue;
      rank[y][x] = n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && X < Wm && Y >= 0 && Y < Hm && rank[Y][X] < 0) front.push([X, Y]);
      }
    }
    // A glider moves one cell diagonally every 4 generations, so it comes back to its
    // start after 4 * lcm(Wm, Hm) generations on the torus (36 on 9 by 9).
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const CYCLE = Math.min(4 * ((Wm * Hm) / gcd(Wm, Hm)), 4000);
    const ox = Math.floor((Wm - 9) / 2), oy = Math.floor((Hm - 9) / 2);
    const gens = [];
    let g = new Set([[4, 3], [5, 4], [3, 5], [4, 5], [5, 5]].map(([x, y]) => x + ox + ',' + (y + oy)));
    for (let i = 0; i < CYCLE; i++) {
      gens.push(g);
      const count = new Map();
      for (const key of g) {
        const [x, y] = key.split(',').map(Number);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const q = ((x + dx + Wm) % Wm) + ',' + ((y + dy + Hm) % Hm);
          count.set(q, (count.get(q) || 0) + 1);
        }
      }
      const next = new Set();
      for (const [key, v] of count) if (v === 3 || (v === 2 && g.has(key))) next.add(key);
      g = next;
    }
    let gen = 0, genF = 0;
    return {
      seed: 8,
      key: (c) => rank[c.my][c.mx],
      group: (c) => rank[c.my][c.mx],
      frame(t) { const x = t / 0.13; gen = Math.floor(x) % CYCLE; genF = x % 1; },
      idle(c) {
        const key = c.mx + ',' + c.my, now = gens[gen], before = gens[(gen + CYCLE - 1) % CYCLE];
        if (now.has(key)) return before.has(key) ? 0.7 : 1 - 0.3 * genF;
        return before.has(key) ? 0.45 * (1 - genF) : 0;
      }
    };
  };

  // Checker. One pass fills every dark square from the top left, a second pass
  // fills the light squares back from the bottom right. While waiting, the two
  // sets of squares trade places in a diagonal shimmer. On larger grids a square
  // is k by k cells.
  PATTERNS.checker = (G) => {
    const span = G.Wm + G.Hm - 2, par = (c) => (c.mx + c.my) % 2;
    return {
      seed: 9,
      key: (c) => par(c) * 1e7 + (par(c) ? span - (c.mx + c.my) : c.mx + c.my) * 1e4 + c.mx * 10 + c.my * 0.01,
      group: (c) => c.my * G.Wm + c.mx,
      idle(c, t) {
        const w = 0.5 + 0.5 * Math.cos(TAU * t * 1.25 - (c.mx + c.my) * 0.38);
        const i = par(c) ? w : 1 - w;
        return i * i;
      }
    };
  };

  // Knight. The fill follows a knight's tour: every cell visited once, each step an
  // L-shaped jump. While waiting, a knight hops at random and leaves a short trail.
  // On larger grids the board's squares are k by k cells.
  PATTERNS.knight = (G) => {
    const Wm = G.Wm, Hm = G.Hm;
    const MOVES = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    const onBoard = (x, y) => x >= 0 && x < Wm && y >= 0 && y < Hm;
    // Warnsdorff: always jump to the cell with the fewest onward jumps.
    const rank = Array.from({ length: Hm }, () => Array(Wm).fill(-1));
    let x = 0, y = 0, n = 0;
    for (; n < Wm * Hm; n++) {
      rank[y][x] = n;
      let best = null, bestDeg = 9;
      for (const [dx, dy] of MOVES) {
        const X = x + dx, Y = y + dy;
        if (!onBoard(X, Y) || rank[Y][X] >= 0) continue;
        const deg = MOVES.filter(([ex, ey]) => onBoard(X + ex, Y + ey) && rank[Y + ey][X + ex] < 0).length;
        if (deg < bestDeg) { bestDeg = deg; best = [X, Y]; }
      }
      if (!best) break;
      [x, y] = best;
    }
    // If the tour gets stuck on an awkward board, the rest fill in reading order.
    for (let Y = 0; Y < Hm; Y++) for (let X = 0; X < Wm; X++) if (rank[Y][X] < 0) rank[Y][X] = ++n;
    // The walk restarts from the center every 48 hops, about once per loop.
    const HOP = 0.19, TRAIL = 5, walk = [];
    const sx = Math.floor(Wm / 2), sy = Math.floor(Hm / 2);
    let hop = 0, hopF = 0;
    return {
      seed: 10,
      key: (c) => rank[c.my][c.mx],
      group: (c) => rank[c.my][c.mx],
      frame(t) {
        hop = Math.floor(t / HOP) % 48; hopF = (t / HOP) % 1;
        walk.length = 0;
        let x = sx, y = sy;
        for (let j = 0; j <= hop; j++) {
          if (j > 0) {
            const ok = MOVES.filter(([dx, dy]) => onBoard(x + dx, y + dy));
            const [dx, dy] = ok[Math.floor(hash(j * 2.7, 3.3) * ok.length)];
            x += dx; y += dy;
          }
          if (j > hop - TRAIL) walk.push([x, y, hop - j]);
        }
      },
      idle(c) {
        let i = 0;
        for (const [x, y, age] of walk) {
          if (x !== c.mx || y !== c.my) continue;
          i = Math.max(i, age === 0 ? 0.6 + 0.4 * Math.min(1, hopF * 4) : 0.75 * Math.exp(-(age + hopF) * 0.6));
        }
        return i;
      }
    };
  };

  /* Fill order --------------------------------------------------------- */
  // Built once per pattern and grid size: each cell's place, its turn k in 0..1,
  // and for the demo loop the time tf that progress reaches it.
  const BUILT = {};
  function grid(W, H) {
    const S = Math.min(W, H) / N, k = Math.max(1, Math.round(S));
    return { W, H, cx: (W - 1) / 2, cy: (H - 1) / 2, S, k, Wm: Math.ceil(W / k), Hm: Math.ceil(H / k) };
  }
  function build(name, W = N, H = N) {
    const id = name + ':' + W + 'x' + H;
    if (BUILT[id]) return BUILT[id];
    const G = grid(W, H);
    const P = PATTERNS[name](G);
    // Progress across the demo run, with a few stalls the way real transfers have
    // them. Knots are random but fixed per pattern; the curve eases between them.
    const ku = [0], kp = [0];
    for (let i = 1; i <= 6; i++) { ku.push(i / 7 + (hash(P.seed, i) - 0.5) * 0.08); kp.push(kp[i - 1] + 0.4 + hash(P.seed, i + 20)); }
    ku.push(1); kp.push(kp[6] + 0.4 + hash(P.seed, 40));
    const kn = kp.map((q) => q / kp[7]);
    const progress = (t) => {
      const u = clamp01((t - RUN0) / (RUN1 - RUN0));
      let i = 1;
      while (i < 7 && u > ku[i]) i++;
      return kn[i - 1] + (kn[i] - kn[i - 1]) * smooth(clamp01((u - ku[i - 1]) / (ku[i] - ku[i - 1])));
    };
    const tab = Array.from({ length: 1201 }, (_, i) => progress(RUN0 + ((RUN1 - RUN0) * i) / 1200));
    const fillTime = (k) => {
      let lo = 0, hi = 1200;
      while (lo < hi) { const m = (lo + hi) >> 1; if (tab[m] >= k) hi = m; else lo = m + 1; }
      return RUN0 + ((RUN1 - RUN0) * lo) / 1200;
    };

    const cells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - G.cx, dy = y - G.cy;
      cells.push({ x, y, dx, dy, mx: Math.floor(x / G.k), my: Math.floor(y / G.k), r: Math.hypot(dx, dy), th: (Math.atan2(dx, -dy) + TAU) % TAU, h: hash(x + 0.5, y + 0.5) });
    }
    for (const c of cells) { c.raw = P.key(c); c.g = P.group ? P.group(c) : null; }
    [...cells].sort((a, b) => a.raw - b.raw || a.y - b.y || a.x - b.x).forEach((c, i) => { c.k = (i + 1) / cells.length; });
    if (P.group) {
      const top = new Map();
      for (const c of cells) top.set(c.g, Math.max(top.get(c.g) || 0, c.k));
      for (const c of cells) c.k = top.get(c.g);
    }
    for (const c of cells) c.tf = fillTime(c.k);
    return (BUILT[id] = { P, G, cells, progress });
  }

  /* Element ------------------------------------------------------------ */
  class DotLoader extends HTMLElement {
    static get observedAttributes() { return ['pattern', 'value', 'loop', 'label', 'fill']; }

    get value() { const v = this.getAttribute('value'); return v == null || v === '' || isNaN(+v) ? null : Math.max(0, Math.min(100, +v)); }
    set value(v) { if (v == null) this.removeAttribute('value'); else this.setAttribute('value', String(v)); }
    get pattern() { const p = this.getAttribute('pattern'); return PATTERNS[p] ? p : 'tide'; }
    set pattern(p) { this.setAttribute('pattern', p); }
    get progress() { return this._shown == null ? null : Math.floor(this._shown * 100); }
    get columns() { return this._gw || N; }
    get rows() { return this._gh || N; }

    connectedCallback() {
      if (this._live) return;
      ensureTokens();
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      // Hidden until its own stylesheet loads, so it never shows at the wrong size.
      root.innerHTML = '<style>:host { display: inline-block; visibility: hidden; }</style>' +
        '<link rel="stylesheet" href="' + url(TAG + '.css') + '"><canvas aria-hidden="true"></canvas>';
      this._cv = root.querySelector('canvas');
      this._ctx = this._cv.getContext('2d');
      if (!this.hasAttribute('role')) this.setAttribute('role', 'progressbar');
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', '100');
      this._label();
      this._reset();
      this._colors();
      this._live = true;
      this._visible = true;
      this._ro = new ResizeObserver(() => this._size());
      this._ro.observe(this);
      this._io = new IntersectionObserver(([en]) => { this._visible = en.isIntersecting; });
      this._io.observe(this);
      const tick = (now) => {
        if (!this._live) return;
        if (this._visible) this.draw(now);
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    disconnectedCallback() {
      this._live = false;
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
    }

    attributeChangedCallback(name) {
      if (!this._cv) return;
      if (name === 'pattern') this._reset();
      if (name === 'label') this._label();
      if (name === 'fill') this._size();
    }

    _label() { this.setAttribute('aria-label', this.getAttribute('label') || 'Loading'); }

    // Live state: when each cell's turn came and when it was cleared.
    _reset() {
      this._B = build(this.pattern, this._gw || N, this._gh || N);
      this._at = new Array(this._B.cells.length).fill(null);
      this._clr = new Array(this._B.cells.length).fill(null);
      this._p = 0; this._env = 0; this._last = null; this._doneAt = null; this._shown = null; this._now = null;
    }

    _colors() {
      const css = getComputedStyle(this);
      const tok = (k) => css.getPropertyValue('--' + k).trim();
      this._col = ['accent', 'data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-5-low'].map(tok);
      this._rxs = parseFloat(tok('radius-xs')) || 2;
    }

    // Square by default: nine cells scaled to the width. With fill, the grid keeps the
    // 140px cell size (12px cells on a 16px pitch) and adds cells until the box is
    // covered, centred; a box smaller than 140px falls back to nine cells that fit.
    _size() {
      const fill = this.hasAttribute('fill');
      const w = this.clientWidth, h = fill ? this.clientHeight : w;
      if (!w || !h) return;
      let u = Math.min(w, h) / 35, gw = N, gh = N;
      if (fill && Math.min(w, h) >= 140) {
        u = 4;
        gw = Math.max(N, Math.floor((w + u) / (4 * u)));
        gh = Math.max(N, Math.floor((h + u) / (4 * u)));
      }
      this._ox = (w - (gw * 4 - 1) * u) / 2;
      this._oy = (h - (gh * 4 - 1) * u) / 2;
      const dpr = window.devicePixelRatio || 1;
      this._w = w; this._h = h; this._u = u;
      this._cv.width = Math.round(w * dpr); this._cv.height = Math.round(h * dpr);
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (gw !== this._gw || gh !== this._gh) { this._gw = gw; this._gh = gh; this._reset(); }
      if (!this._col[0]) this._colors();
    }

    // One square at grid position (x, y), scale s of a full cell, color index ci.
    _paint(x, y, s, ci, a) {
      const u = this._u, cell = 3 * u, w = cell * s, ctx = this._ctx;
      const cx = this._ox + x * 4 * u + cell / 2, cy = this._oy + y * 4 * u + cell / 2;
      ctx.globalAlpha = a;
      ctx.fillStyle = this._col[ci];
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - w / 2, w, w, Math.min(this._rxs, w / 4));
      ctx.fill();
    }

    draw(ms) {
      if (!this._cv) return;
      if (!this._w) this._size();
      if (!this._w) return;
      if (!this._col[0]) this._colors();
      const { P, cells, progress } = this._B;
      const still = STILL.matches, loop = this.hasAttribute('loop');
      const F = { t: 0, p: 0, env: 0, hand: false, still, paint: (x, y, s, ci, a) => this._paint(x, y, s, ci, a), at: null };
      let flash = -1, waiting;
      const at = new Array(cells.length), drain = new Array(cells.length).fill(0);

      if (loop) {
        // The demo loop is a pure function of the page clock, so it records seamlessly.
        const t = ((ms / 1000) % LOOP + LOOP) % LOOP;
        F.t = t;
        F.p = t < RUN0 ? 0 : t >= RUN1 ? 1 : progress(t);
        F.env = smooth(clamp01(t / 0.35)) * (1 - smooth(clamp01((t - (RUN0 - 0.15)) / 0.35)));
        F.hand = t >= RUN0 && t < DRAIN0;
        waiting = t < RUN0;
        if (!still && t >= RUN1 && t < RUN1 + 0.75) flash = ((t - RUN1) / 0.6) * 1.3 - 0.15;
        cells.forEach((c, i) => {
          at[i] = t >= c.tf ? c.tf : null;
          if (t >= DRAIN0) drain[i] = clamp01((((t - DRAIN0) / (DRAIN1 - DRAIN0)) * 1.25 - (1 - c.k)) / 0.25);
        });
      } else {
        // Live: progress eases toward value; cells take their turn as it passes them.
        const now = ms / 1000, dt = this._last == null ? 0 : Math.min(0.1, Math.max(0, now - this._last));
        this._last = now;
        const v = this.value;
        waiting = v == null;
        const target = waiting ? 0 : v / 100;
        const k = 1 - Math.exp(-dt / 0.18);
        this._p = still ? target : this._p + (target - this._p) * k;
        if (Math.abs(target - this._p) < 0.0005) this._p = target;
        this._env = still ? (waiting ? 1 : 0) : this._env + ((waiting ? 1 : 0) - this._env) * (1 - Math.exp(-dt / 0.2));
        F.t = now; F.p = this._p; F.env = this._env < 0.01 ? 0 : this._env; F.hand = !waiting;
        if (F.p >= 0.999) {
          if (this._doneAt == null) {
            this._doneAt = now;
            this.dispatchEvent(new CustomEvent('dot-loader-complete', { bubbles: true, composed: true }));
          }
          if (!still && now - this._doneAt < 0.75) flash = ((now - this._doneAt) / 0.6) * 1.3 - 0.15;
        } else if (F.p < 0.99) this._doneAt = null;
        cells.forEach((c, i) => {
          if (F.p >= c.k - 1e-6) { if (this._at[i] == null) { this._at[i] = now; this._clr[i] = null; } }
          else if (this._at[i] != null) { this._at[i] = null; this._clr[i] = now; }
          at[i] = this._at[i];
          if (this._clr[i] != null) {
            drain[i] = still ? 1 : clamp01((now - this._clr[i]) / 0.35);
            if (drain[i] >= 1) this._clr[i] = null;
          }
        });
      }
      F.at = (i) => at[i];
      this._shown = waiting ? null : F.p;
      this._aria(waiting, F.p);

      if (P.frame) P.frame(F.t);
      const ctx = this._ctx, O = { s: REST, c: 6 };
      ctx.clearRect(0, 0, this._w, this._h);
      cells.forEach((c, i) => {
        O.s = REST; O.c = 6;
        if (P.run) P.run(c, F, O);
        else if (at[i] != null) {
          const age = F.t - at[i] - (still ? 0 : P.delay || 0);
          if (age >= 0) {
            if (still) { O.s = 1; O.c = 2; }
            else {
              O.s = REST + (1 - REST) * (age < 0.24 ? backOut(age / 0.24) : 1);
              O.c = age < 0.3 ? 0 : age < 0.6 ? 1 : 2;
            }
          }
        }
        // Done: a bright pass runs through the fill in its own order.
        if (flash > -1 && O.s > 0.9 && Math.abs(c.k - flash) < 0.12) O.c = Math.abs(c.k - flash) < 0.06 ? 0 : 1;
        // Drain: cells shrink back to rest.
        let a = drain[i];
        if (still && a > 0) a = 1;
        if (a > 0 && O.s > REST + 0.01) { O.s += (REST - O.s) * smooth(a); O.c = a < 0.35 ? 3 : a < 0.7 ? 5 : 6; }
        // Waiting.
        if (F.env > 0) {
          const iv = (still ? 0.3 + 0.15 * Math.sin((TAU * F.t) / 1.6) : P.idle ? P.idle(c, F.t) : 0) * F.env;
          const s = REST + (1 - REST) * iv;
          if (iv > 0.02 && s > O.s) { O.s = s; O.c = tier(iv); }
        }
        if (P.post && !still) P.post(c, F, O);
        this._paint(c.x, c.y, O.s, O.c, 1);
      });
      if (P.extra) P.extra(F);
      ctx.globalAlpha = 1;
    }

    _aria(waiting, p) {
      const now = waiting ? '' : String(Math.floor(p * 100));
      if (this._now === now) return;
      this._now = now;
      if (now) { this.setAttribute('aria-valuenow', now); this.removeAttribute('aria-valuetext'); }
      else { this.removeAttribute('aria-valuenow'); this.setAttribute('aria-valuetext', 'Waiting for size'); }
    }
  }

  if (!customElements.get(TAG)) customElements.define(TAG, DotLoader);
})();
