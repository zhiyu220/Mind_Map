// The picture-book land, drawn once as SVG markup. The hand-drawn wobble is baked into the
// shapes (no live SVG filters), so scrolling and the few small animations stay smooth on iPhone.

export const H = 600;
export const STEP = 100; // distance between two session dots
export const X0 = 230; // first session dot
export const AHEAD = 560; // land after the walker
// hills, grass and road run on past both ends, so the edge never shows if the page bounces
const BLEED = 400;

export const pathY = (x: number) => 418 + 9 * Math.sin(x / 95);
export const groundY = (x: number) => 360 + 12 * Math.sin(x / 140 + 1);
const hillY = (x: number) => 292 + 26 * Math.sin(x / 230) + 12 * Math.sin(x / 83 + 2);
const frontY = (x: number) => 492 + 8 * Math.sin(x / 60);

const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const wob = (x: number) => {
  const i = Math.floor(x / 9), t = x / 9 - i, a = hash(i), b = hash(i + 1);
  return (a + (b - a) * t * t * (3 - 2 * t) - 0.5) * 2.4;
};

/** A slightly uneven circle, like one drawn by hand. */
export function blob(cx: number, cy: number, r: number, k = 11): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2, rr = r * (1 + (hash(cx * 7.1 + cy * 3.3 + i) - 0.5) * 0.12);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m = mid(pts[k - 1], pts[0]);
  let d = `M${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  for (let i = 0; i < k; i++) {
    const p = pts[i], n = mid(p, pts[(i + 1) % k]);
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${n[0].toFixed(1)} ${n[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hills, trees, house, fences, the road and its footprints: everything behind the dots. */
export function landMarkup(width: number, walkerX: number): { back: string; front: string } {
  const rnd = seeded(11); // the meadow looks the same every visit
  const wave = (f: (x: number) => number, step = 12) => {
    let d = `M ${-BLEED} ${f(-BLEED).toFixed(1)}`;
    for (let x = -BLEED; x <= width + BLEED; x += step) d += ` L ${x} ${(f(x) + wob(x)).toFixed(1)}`;
    return d;
  };
  const band = (f: (x: number) => number) => wave(f) + ` L ${width + BLEED} ${H + 20} L ${-BLEED} ${H + 20} Z`;

  let hills = `<path d="${band(hillY)}" fill="var(--hill-far)"/><path d="${band(hillY)}" fill="url(#hatch)" stroke="none"/>`;
  for (let x = 60; x < width; x += 70 + rnd() * 90) {
    const y = hillY(x) + 4, h = 26 + rnd() * 18;
    if (rnd() < 0.5) hills += `<g><path d="M${x} ${y} v-${h * 0.5}" stroke-width="3" fill="none" stroke="var(--trunk)"/><path d="${blob(x, y - h * 0.75, h * 0.38)}" fill="var(--tree)"/></g>`;
    else hills += `<g><path d="M${x} ${y - h * 1.1} L${x + h * 0.32} ${y - 4} L${x - h * 0.32} ${y - 4} Z" fill="var(--tree-2)"/><path d="M${x} ${y - 4} v4" stroke="var(--trunk)" stroke-width="3"/></g>`;
  }
  const hx = 90, hy = hillY(90) + 6;
  hills += `<g><rect x="${hx - 20}" y="${hy - 30}" width="40" height="30" fill="var(--wall)"/><path d="M${hx - 26} ${hy - 28} L${hx} ${hy - 50} L${hx + 26} ${hy - 28} Z" fill="var(--roof)"/><rect x="${hx - 5}" y="${hy - 16}" width="10" height="16" fill="var(--trunk)"/><rect x="${hx + 8}" y="${hy - 24}" width="7" height="7" fill="var(--sky)"/></g>`;

  let ground = `<path d="${band(groundY)}" fill="var(--hill-near)"/><path d="${band(groundY)}" fill="url(#hatch)" stroke="none"/>`;
  const fences: [number, number][] = [[X0 - 160, X0 + 60]];
  for (let a = X0 + STEP * 2.4; a < width - 200; a += STEP * 6.5) fences.push([a, a + STEP * 1.5]);
  for (const [a, b] of fences) {
    let posts = '';
    for (let x = a; x <= b; x += 34) posts += `<path d="M${x} ${groundY(x) + 30} v-30"/>`;
    ground += `<g stroke="var(--fence)" stroke-width="4" fill="none">${posts}<path d="M${a} ${groundY(a) + 10} L${b} ${groundY(b) + 10} M${a} ${groundY(a) + 20} L${b} ${groundY(b) + 20}" stroke-width="3"/></g>`;
  }
  ground += `<path d="${wave(pathY)}" fill="none" stroke="var(--sand)" stroke-width="40" stroke-linecap="round"/>`;

  let tufts = '';
  for (let x = 20; x < width; x += 40 + rnd() * 60) {
    const y = groundY(x) + 22 + rnd() * 20;
    tufts += `<path d="M${x - 4} ${y} l2 -8 l2 8 M${x} ${y} l3 -11 l1 11 M${x + 4} ${y} l4 -7" fill="none" stroke="var(--tree)" stroke-width="2"/>`;
  }

  let prints = '';
  for (let x = 30; x < walkerX - 10; x += 22) prints += `<ellipse cx="${x}" cy="${(pathY(x) + (Math.round(x / 22) % 2 ? 5 : -5)).toFixed(1)}" rx="4.5" ry="2.6" fill="var(--foot)"/>`;
  for (let x = walkerX + 140; x < width - 40; x += 26) prints += `<circle cx="${x}" cy="${pathY(x).toFixed(1)}" r="3" fill="var(--foot)" opacity=".7"/>`;

  let front = `<path d="${band(frontY)}" fill="var(--grass-front)"/>`;
  for (let x = 10; x < width; x += 18 + rnd() * 30) {
    const y = frontY(x) + 10 + rnd() * 30;
    if (rnd() < 0.55) {
      const c = ['--f1', '--f2', '--f3', '--f4'][Math.floor(rnd() * 4)];
      const r = 3 + rnd() * 2;
      const petals = [0, 72, 144, 216, 288]
        .map(a => `<circle cx="${(x + Math.cos((a * Math.PI) / 180) * r).toFixed(1)}" cy="${(y + Math.sin((a * Math.PI) / 180) * r).toFixed(1)}" r="${(r * 0.7).toFixed(1)}"/>`)
        .join('');
      front += `<g><path d="M${x} ${y + 12} v-12" stroke="var(--tree)" stroke-width="2"/><g fill="var(${c})" stroke-width="1.5">${petals}</g><circle cx="${x}" cy="${y}" r="${(r * 0.45).toFixed(1)}" fill="var(--scarf)" stroke="none"/></g>`;
    } else {
      front += `<path d="M${x - 5} ${y + 8} l3 -10 l2 10 M${x} ${y + 8} l4 -14 l1 14 M${x + 4} ${y + 8} l5 -9" fill="none" stroke="var(--tree)" stroke-width="2"/>`;
    }
  }

  const ink = 'stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  return {
    back: `<g ${ink}>${hills}${ground}${tufts}</g>${prints}`,
    front: `<g ${ink}>${front}</g>`
  };
}
