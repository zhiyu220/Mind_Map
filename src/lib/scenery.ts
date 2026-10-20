// The picture-book land, drawn once as SVG markup. The hand-drawn wobble is baked into the
// shapes (no live SVG filters), so scrolling and the few small animations stay smooth on iPhone.

export const H = 600;
export const STEP = 100; // distance between two session dots
export const X0 = 230; // first session dot
export const AHEAD = 560; // land after the walker
export const START = 125; // the road begins here, where the path from the house comes down
export const SIGN_X = 55; // the 起點 sign, beside that path
// hills, grass and road run on past both ends, so the edge never shows if the page bounces
const BLEED = 400;

export const pathY = (x: number) => 418 + 9 * Math.sin(x / 95);
export const groundY = (x: number) => 360 + 12 * Math.sin(x / 140 + 1);
const hillY = (x: number) => 292 + 26 * Math.sin(x / 230) + 12 * Math.sin(x / 83 + 2);

// Milestones: the road changes as you go. Not rewards, just how far you've come.
export const BENCH_AT = 10; // a bench by the road
export const RIVER_AT = 20; // a little river, with a bridge
export const SEA_AT = 30; // the sea, from here on
const HORIZON = 262;
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
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
export function landMarkup(width: number, walkerX: number, n = 0): { back: string; front: string } {
  const rnd = seeded(11); // the meadow looks the same every visit
  const dot = (i: number) => X0 + i * STEP;
  // from the 30th session on, the far hills sink and the sea shows behind them
  const seaX = n >= SEA_AT ? dot(SEA_AT - 1) - STEP * 1.5 : Infinity;
  const farY = (x: number) => hillY(x) + 46 * smooth((x - seaX) / 240);
  const wave = (f: (x: number) => number, step = 12) => {
    let d = `M ${-BLEED} ${f(-BLEED).toFixed(1)}`;
    for (let x = -BLEED; x <= width + BLEED; x += step) d += ` L ${x} ${(f(x) + wob(x)).toFixed(1)}`;
    return d;
  };
  const band = (f: (x: number) => number) => wave(f) + ` L ${width + BLEED} ${H + 20} L ${-BLEED} ${H + 20} Z`;

  let sea = '';
  if (seaX < Infinity) {
    const r2 = seeded(29), a = seaX + 40;
    // the coast curves in from behind the hills, so the sea opens up rather than starting as a box
    sea = `<path d="M${a + 150} ${HORIZON} L${width + BLEED} ${HORIZON} L${width + BLEED} ${H} L${a - 40} ${H} C${a - 10} ${HORIZON + 60}, ${a + 50} ${HORIZON + 6}, ${a + 150} ${HORIZON} Z" fill="var(--sea)"/>`;
    let waves = '';
    for (let x = a + 190; x < width; x += 60 + r2() * 50) {
      const y = HORIZON + 14 + r2() * 34;
      waves += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q6 -5 12 0 q6 -5 12 0"/>`;
    }
    const bx = Math.min(width - 120, a + 260), by = HORIZON + 22;
    sea += `<g fill="none" stroke="var(--sea-line)" stroke-width="2">${waves}</g>`;
    sea += `<g><path d="M${bx - 16} ${by} h32 l-6 8 h-20 Z" fill="var(--roof)"/><path d="M${bx} ${by} v-26 l14 22 Z" fill="var(--paper)"/></g>`;
  }

  let hills = `${sea}<path d="${band(farY)}" fill="var(--hill-far)"/><path d="${band(farY)}" fill="url(#hatch)" stroke="none"/>`;
  for (let x = 60; x < width; x += 70 + rnd() * 90) {
    const y = farY(x) + 4, h = 26 + rnd() * 18, round = rnd() < 0.5;
    if (x > seaX + 120) continue; // nothing grows on the far side of the hills by the sea
    const cy = y - h * 0.75, cr = h * 0.38;
    // spring: blossoms on the round trees; winter: snow on every tree
    if (round) hills += `<g><path d="M${x} ${y} v-${h * 0.5}" stroke-width="3" fill="none" stroke="var(--trunk)"/><path d="${blob(x, cy, cr)}" fill="var(--canopy)"/>`
      + `<g class="s-spring" fill="var(--f1)" stroke-width="1.2"><circle cx="${(x - cr * 0.4).toFixed(1)}" cy="${(cy - cr * 0.2).toFixed(1)}" r="2.6"/><circle cx="${(x + cr * 0.35).toFixed(1)}" cy="${(cy - cr * 0.35).toFixed(1)}" r="2.6"/><circle cx="${(x + cr * 0.1).toFixed(1)}" cy="${(cy + cr * 0.35).toFixed(1)}" r="2.6"/></g>`
      + `<path class="s-winter" d="M${(x - cr * 0.85).toFixed(1)} ${(cy - cr * 0.3).toFixed(1)} C ${(x - cr * 0.6).toFixed(1)} ${(cy - cr * 1.15).toFixed(1)}, ${(x + cr * 0.6).toFixed(1)} ${(cy - cr * 1.15).toFixed(1)}, ${(x + cr * 0.85).toFixed(1)} ${(cy - cr * 0.3).toFixed(1)} Q ${(x + cr * 0.4).toFixed(1)} ${(cy - cr * 0.05).toFixed(1)} ${x} ${(cy - cr * 0.35).toFixed(1)} Q ${(x - cr * 0.4).toFixed(1)} ${(cy - cr * 0.05).toFixed(1)} ${(x - cr * 0.85).toFixed(1)} ${(cy - cr * 0.3).toFixed(1)} Z" fill="var(--snow)"/></g>`;
    else hills += `<g><path d="M${x} ${y - h * 1.1} L${x + h * 0.32} ${y - 4} L${x - h * 0.32} ${y - 4} Z" fill="var(--canopy-2)"/><path d="M${x} ${y - 4} v4" stroke="var(--trunk)" stroke-width="3"/>`
      + `<path class="s-winter" d="M${x} ${y - h * 1.1} L${(x + h * 0.14).toFixed(1)} ${(y - h * 0.62).toFixed(1)} L${x} ${(y - h * 0.7).toFixed(1)} L${(x - h * 0.14).toFixed(1)} ${(y - h * 0.62).toFixed(1)} Z" fill="var(--snow)"/></g>`;
  }
  const hx = 90, hy = hillY(90) + 6;
  hills += `<g><rect x="${hx - 20}" y="${hy - 30}" width="40" height="30" fill="var(--wall)"/><path d="M${hx - 26} ${hy - 28} L${hx} ${hy - 50} L${hx + 26} ${hy - 28} Z" fill="var(--roof)"/><rect x="${hx - 5}" y="${hy - 16}" width="10" height="16" fill="var(--trunk)"/><rect x="${hx + 8}" y="${hy - 24}" width="7" height="7" fill="var(--sky)"/>`
    + `<path class="s-winter" d="M${hx - 27} ${hy - 28} L${hx} ${hy - 51} L${hx + 27} ${hy - 28} L${hx + 19} ${hy - 31} L${hx} ${hy - 44} L${hx - 19} ${hy - 31} Z" fill="var(--snow)"/></g>`;
  // a snowman next to the house, only in winter
  const sx = 150, sy = farY(150) + 8;
  hills += `<g class="s-winter"><circle cx="${sx}" cy="${sy - 10}" r="11" fill="var(--snow)"/><circle cx="${sx}" cy="${sy - 27}" r="8" fill="var(--snow)"/><path d="M${sx + 1} ${sy - 27} l7 2 l-7 1 Z" fill="var(--coat)" stroke-width="1.2"/><circle cx="${sx - 3}" cy="${sy - 30}" r="1.2" fill="var(--ink)" stroke="none"/><path d="M${sx - 8} ${sy - 21} h16" stroke="var(--scarf)" stroke-width="3"/></g>`;

  let ground = `<path d="${band(groundY)}" fill="var(--hill-near)"/><path d="${band(groundY)}" fill="url(#hatch)" stroke="none"/>`;
  // the path from the house's door down to where the road begins
  const door = hillY(90) + 6;
  ground += `<path d="M90 ${door.toFixed(1)} C 92 ${(door + 40).toFixed(1)}, 108 ${(pathY(START) - 34).toFixed(1)}, ${START + 12} ${pathY(START + 12).toFixed(1)}" fill="none" stroke="var(--sand)" stroke-width="16" stroke-linecap="round"/>`;
  const fences: [number, number][] = [[-160, SIGN_X - 50]];
  for (let a = X0 + STEP * 2.4; a < width - 200; a += STEP * 6.5) fences.push([a, a + STEP * 1.5]);
  for (const [a, b] of fences) {
    let posts = '';
    for (let x = a; x <= b; x += 34) posts += `<path d="M${x} ${groundY(x) + 30} v-30"/>`;
    ground += `<g stroke="var(--fence)" stroke-width="4" fill="none">${posts}<path d="M${a} ${groundY(a) + 10} L${b} ${groundY(b) + 10} M${a} ${groundY(a) + 20} L${b} ${groundY(b) + 20}" stroke-width="3"/></g>`;
  }
  // the river runs from the hills down past the front of the picture, under a little bridge
  const rx = n >= RIVER_AT ? dot(RIVER_AT - 1) + STEP / 2 : null;
  const river = (y0: number, y1: number) => {
    if (rx === null) return '';
    const cx = (y: number) => rx + 22 * Math.sin(y / 38) - (y - 400) * 0.18;
    const hw = (y: number) => 5 + 20 * smooth((y - 300) / 260);
    let l = '', r = '';
    for (let y = y0; y <= y1; y += 8) {
      l += `${l ? ' L' : 'M'}${(cx(y) - hw(y)).toFixed(1)} ${y}`;
      r = ` L${(cx(y) + hw(y)).toFixed(1)} ${y}` + r;
    }
    // filled without an outline, then only its two banks inked, so a piece of it has no seam at the top
    const bank = (side: number) => {
      let d = '';
      for (let y = y0; y <= y1; y += 8) d += `${d ? ' L' : 'M'}${(cx(y) + side * hw(y)).toFixed(1)} ${y}`;
      return `<path d="${d}" fill="none"/>`;
    };
    return `<path d="${l}${r} Z" fill="var(--w-rain)" stroke="none"/>${bank(-1)}${bank(1)}`;
  };
  ground += river(Math.round(hillY(rx ?? 0)) + 6, H + 20);
  let road = `M ${START} ${pathY(START).toFixed(1)}`;
  for (let x = START + 6; x <= width + BLEED; x += 12) road += ` L ${x} ${(pathY(x) + wob(x)).toFixed(1)}`;
  ground += `<path d="${road}" fill="none" stroke="var(--sand)" stroke-width="40" stroke-linecap="round"/>`;
  if (rx !== null) {
    let planks = '';
    for (let x = rx - 34; x <= rx + 34; x += 9.7) planks += `<rect x="${x.toFixed(1)}" y="${(pathY(x) - 21).toFixed(1)}" width="8" height="42" rx="2"/>`;
    ground += `<g fill="var(--fence)" stroke-width="1.8">${planks}</g>`;
    ground += `<path d="M${rx - 38} ${pathY(rx - 38) - 22} L${rx + 38} ${pathY(rx + 38) - 22}" stroke="var(--trunk)" stroke-width="4" fill="none"/>`;
  }
  // a bench by the road, to sit for a while
  if (n >= BENCH_AT) {
    const bx = dot(BENCH_AT - 1) + 40, by = pathY(bx) - 26;
    ground += `<g><path d="M${bx - 22} ${by + 12} v-10 M${bx + 22} ${by + 12} v-10 M${bx - 18} ${by - 10} v12 M${bx + 18} ${by - 10} v12" stroke="var(--trunk)" stroke-width="3.5" fill="none"/><rect x="${bx - 28}" y="${by - 2}" width="56" height="7" rx="2" fill="var(--fence)"/><rect x="${bx - 26}" y="${by - 18}" width="52" height="7" rx="2" fill="var(--fence)"/></g>`;
  }

  // autumn: haystacks in the fields
  for (let x = X0 + STEP * 0.8; x < width - 100; x += STEP * 5.6) {
    const y = groundY(x) + 18;
    ground += `<g class="s-autumn"><path d="M${x - 24} ${y} C ${x - 22} ${y - 34}, ${x + 22} ${y - 34}, ${x + 24} ${y} Z" fill="#ecc75e"/><path d="M${x - 12} ${y - 4} l3 -14 M${x} ${y - 4} l0 -18 M${x + 12} ${y - 4} l-3 -14" stroke="#b8902f" stroke-width="2" fill="none"/></g>`;
  }

  let tufts = '';
  for (let x = 20; x < width; x += 40 + rnd() * 60) {
    const y = groundY(x) + 22 + rnd() * 20;
    tufts += `<path d="M${x - 4} ${y} l2 -8 l2 8 M${x} ${y} l3 -11 l1 11 M${x + 4} ${y} l4 -7" fill="none" stroke="var(--tree)" stroke-width="2"/>`;
  }

  let prints = '';
  for (let x = START + 14; x < walkerX - 10; x += 22) prints += `<ellipse cx="${x}" cy="${(pathY(x) + (Math.round(x / 22) % 2 ? 5 : -5)).toFixed(1)}" rx="4.5" ry="2.6" fill="var(--foot)"/>`;
  for (let x = walkerX + 140; x < width - 40; x += 26) prints += `<circle cx="${x}" cy="${pathY(x).toFixed(1)}" r="3" fill="var(--foot)" opacity=".7"/>`;

  let front = `<path d="${band(frontY)}" fill="var(--grass-front)"/>` + river(Math.round(frontY(rx ?? 0)) - 12, H + 20);
  for (let x = 10; x < width; x += 18 + rnd() * 30) {
    const y = frontY(x) + 10 + rnd() * 30, flower = rnd() < 0.55, c = ['--f1', '--f2', '--f3', '--f4'][Math.floor(rnd() * 4)], r = 3 + rnd() * 2;
    if (rx !== null && Math.abs(x - rx + (y - 400) * 0.18) < 46) continue; // not in the river
    if (rnd() < 0.18) {
      // a few things lie in the grass: snow mounds in winter, fallen leaves in autumn
      front += `<path class="s-winter" d="M${x - 16} ${y + 10} C ${x - 12} ${y - 2}, ${x + 12} ${y - 4}, ${x + 18} ${y + 10} Z" fill="var(--snow-shade)" stroke="none"/>`;
      front += `<path class="s-autumn" d="M${x - 5} ${y + 6} c 0 -6 6 -9 11 -8 c 0 5 -5 9 -11 8 Z" fill="${['#e9873e', '#d8a63a', '#c9583a'][Math.floor(rnd() * 3)]}" stroke-width="1.5"/>`;
    }
    if (flower) {
      const petals = [0, 72, 144, 216, 288]
        .map(a => `<circle cx="${(x + Math.cos((a * Math.PI) / 180) * r).toFixed(1)}" cy="${(y + Math.sin((a * Math.PI) / 180) * r).toFixed(1)}" r="${(r * 0.7).toFixed(1)}"/>`)
        .join('');
      front += `<g class="no-winter"><path d="M${x} ${y + 12} v-12" stroke="var(--tree)" stroke-width="2"/><g fill="var(${c})" stroke-width="1.5">${petals}</g><circle cx="${x}" cy="${y}" r="${(r * 0.45).toFixed(1)}" fill="var(--scarf)" stroke="none"/></g>`;
    } else {
      front += `<path class="no-winter" d="M${x - 5} ${y + 8} l3 -10 l2 10 M${x} ${y + 8} l4 -14 l1 14 M${x + 4} ${y + 8} l5 -9" fill="none" stroke="var(--tree)" stroke-width="2"/>`;
    }
  }

  // spring: tulips in little groups; autumn: pumpkins
  const rt = seeded(53);
  for (let x = 60; x < width; x += 170 + rt() * 150) {
    if (rx !== null && Math.abs(x - rx) < 80) continue;
    let tulips = '';
    for (let k = 0; k < 3; k++) {
      const tx = x + k * 13, ty = frontY(tx) + 22 + (k % 2) * 6, c = ['#ff6f91', '#ffcf4a', '#ff9a5a', '#e98fd8'][Math.floor(rt() * 4)];
      tulips += `<path d="M${tx} ${ty + 14} V${ty}" stroke="var(--tree)" stroke-width="2.2"/><path d="M${tx - 5} ${ty - 9} l2.5 4 l2.5 -4 l2.5 4 l2.5 -4 V${ty - 2} C ${tx + 5} ${ty + 2}, ${tx - 5} ${ty + 2}, ${tx - 5} ${ty - 2} Z" fill="${c}" stroke-width="1.6"/>`;
    }
    front += `<g class="s-spring">${tulips}</g>`;
    const py = frontY(x + 40) + 30;
    front += `<g class="s-autumn"><ellipse cx="${x + 40}" cy="${py}" rx="13" ry="10" fill="#f08a2e" stroke-width="2"/><path d="M${x + 40} ${py - 10} v10 M${x + 33} ${py - 8} c -3 6 -3 12 0 16 M${x + 47} ${py - 8} c 3 6 3 12 0 16" fill="none" stroke-width="1.6"/><path d="M${x + 40} ${py - 10} l2 -6" stroke="var(--trunk)" stroke-width="3"/></g>`;
  }

  // summer: tall sunflowers here and there along the front
  const rs = seeded(47);
  for (let x = 90; x < width; x += 150 + rs() * 170) {
    if (rx !== null && Math.abs(x - rx) < 80) continue;
    const y = frontY(x) + 6, h = 26 + rs() * 8, top = y - h; // low enough to stay clear of the dates on the road
    let petals = '';
    for (let a = 0; a < 360; a += 30) petals += `<ellipse cx="${(x + Math.cos((a * Math.PI) / 180) * 9).toFixed(1)}" cy="${(top + Math.sin((a * Math.PI) / 180) * 9).toFixed(1)}" rx="4.5" ry="2.6" transform="rotate(${a} ${(x + Math.cos((a * Math.PI) / 180) * 9).toFixed(1)} ${(top + Math.sin((a * Math.PI) / 180) * 9).toFixed(1)})"/>`;
    front += `<g class="s-summer"><path d="M${x} ${y + 20} V${top}" stroke="var(--tree)" stroke-width="3"/><path d="M${x} ${y - h * 0.4} q -14 -8 -18 2 q 10 4 18 -2 Z" fill="var(--tree)" stroke-width="1.6"/><g fill="#ffc93a" stroke-width="1.4">${petals}</g><circle cx="${x}" cy="${top}" r="6" fill="var(--trunk)"/></g>`;
  }

  const ink = 'stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  return {
    back: `<g ${ink}>${hills}${ground}<g class="no-winter">${tufts}</g></g>${prints}`,
    front: `<g ${ink}>${front}</g>`
  };
}
