// Static drawings shared by the whole app: weather icons, the still sky and drifting clouds.
// The sky is two layers, so the aurora can hang between the sky and the moon and mountains.
// Kept as markup so they are drawn once and never re-rendered. Nothing inside an SVG animates:
// on iPhone that repaints the whole drawing every frame. The clouds move as separate HTML layers instead.

export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="crayon" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/>
      <feDisplacementMap in="SourceGraphic" scale="4"/>
    </filter>
    <path id="cl60" d="M14 42 C 5 42, 5 29, 15 30 C 15 19, 29 16, 33 25 C 37 18, 51 20, 49 31 C 57 31, 57 42, 49 42 Z"/>
    <symbol id="w-sun" viewBox="0 0 60 60"><g filter="url(#crayon)" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"><path d="M30 6v7M30 47v7M6 30h7M47 30h7M13 13l5 5M42 42l5 5M13 47l5-5M42 18l5-5" fill="none"/><circle cx="30" cy="30" r="12" fill="var(--w-sun)"/></g></symbol>
    <symbol id="w-partly" viewBox="0 0 60 60"><g filter="url(#crayon)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"><circle cx="38" cy="22" r="11" fill="var(--w-sun)"/><use href="#cl60" fill="#fffaf0" transform="translate(-4 6)"/></g></symbol>
    <symbol id="w-cloud" viewBox="0 0 60 60"><g filter="url(#crayon)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"><use href="#cl60" fill="var(--w-cloud)" transform="translate(0 2)"/></g></symbol>
    <symbol id="w-rain" viewBox="0 0 60 60"><g filter="url(#crayon)" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><use href="#cl60" fill="var(--w-cloud)" transform="translate(0 -4)"/><path d="M20 45l-3 7M31 45l-3 7M42 45l-3 7" stroke="var(--w-rain)" stroke-width="3" fill="none"/></g></symbol>
    <symbol id="w-storm" viewBox="0 0 60 60"><g filter="url(#crayon)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"><use href="#cl60" fill="var(--w-storm)" transform="translate(0 -5)"/><path d="M31 37l-6 10h6l-3 9 10-13h-6l3-6z" fill="var(--w-sun)"/></g></symbol>
    <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="var(--star-fill, none)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
    <symbol id="i-note" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/></symbol>
  </defs>
</svg>`;

// The aurora: flat ribbons of colour with curtain strokes, like crayon on dark paper.
const AURORA = `<div class="aurora" aria-hidden="true"><svg viewBox="0 0 1200 300" preserveAspectRatio="none">
  <path d="M-20 170 C 150 90, 300 60, 450 120 C 600 180, 720 60, 880 70 C 1020 80, 1120 140, 1220 110 L1220 200 C 1100 220, 1020 160, 880 160 C 720 160, 600 260, 450 210 C 300 160, 150 190, -20 250 Z" fill="#7fe3b4" opacity=".55"/>
  <path d="M-20 120 C 180 40, 330 90, 520 60 C 700 30, 820 120, 1000 90 C 1100 72, 1160 40, 1220 50 L1220 110 C 1140 120, 1080 150, 980 150 C 820 150, 700 90, 520 120 C 330 150, 180 110, -20 180 Z" fill="#b6a3ea" opacity=".4"/>
  <g stroke="#c9f5df" stroke-width="3" stroke-linecap="round" opacity=".55">
    <path d="M80 200 v-50 M140 185 v-60 M210 170 v-70 M290 160 v-80 M380 170 v-70 M470 190 v-60 M560 180 v-50 M650 150 v-70 M740 120 v-50 M830 120 v-50 M920 140 v-60 M1010 160 v-60 M1100 150 v-40"/>
  </g>
</svg></div>`;

export const SKY = `<svg class="back" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><path id="cloud" d="M10 46 C -4 44, 0 22, 20 26 C 22 8, 50 4, 58 20 C 66 8, 92 12, 90 30 C 106 30, 108 48, 94 50 Z"/></defs>
    <rect width="1200" height="600" fill="var(--sky)"/>
    <g stroke="var(--sky-stroke)" stroke-width="5" stroke-linecap="round" fill="none" filter="url(#crayon)">
      <path d="M380 120 q40 -6 80 0 M520 210 q50 -6 100 0 M760 260 q40 -5 80 0 M430 300 q30 -4 60 0 M840 110 q30 -4 60 0"/>
    </g>
    <g style="opacity:var(--stars)" fill="var(--sun)">
      <path d="M470 150 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/>
      <path d="M560 240 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/>
      <path d="M640 120 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/>
      <path d="M745 300 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z"/>
      <path d="M800 200 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z"/>
    </g>
  </svg>
  ${AURORA}
  <svg class="back" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <g filter="url(#crayon)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="700" cy="150" r="30" fill="var(--sun)"/>
      <path style="opacity:var(--rays)" d="M700 104 v-12 M700 196 v12 M654 150 h-12 M746 150 h12 M668 118 l-8 -8 M732 182 l8 8 M668 182 l-8 8 M732 118 l8 -8" fill="none"/>
      <path d="M0 286 L90 226 L150 256 L240 196 L330 261 L420 218 L520 272 L600 222 L690 268 L790 206 L880 256 L960 224 L1060 274 L1200 226 V600 H0 Z" fill="var(--mtn)"/>
      <path d="M240 196 l-18 14 l10 -2 l8 8 l9 -9 l9 3z M790 206 l-18 14 l10 -2 l8 8 l9 -9 l9 3z" fill="var(--cloud)" stroke-width="1.8"/>
    </g>
    <g fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round">
      <path d="M560 200 q6 -6 12 0 q6 -6 12 0"/>
      <path d="M592 186 q4 -4 8 0 q4 -4 8 0"/>
    </g>
  </svg>

  <div class="drift-cloud a" aria-hidden="true"><svg viewBox="-4 0 114 56"><use href="#cloud" fill="var(--cloud)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/></svg></div>
  <div class="drift-cloud b" aria-hidden="true"><svg viewBox="-4 0 114 56"><use href="#cloud" fill="var(--cloud)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/></svg></div>
  <div class="drift-cloud c" aria-hidden="true"><svg viewBox="-4 0 114 56"><use href="#cloud" fill="var(--cloud)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/></svg></div>`;

// What the season brings, each kind its own HTML layer of small pieces that move by transform only.
// All kinds are in the markup; styles.css shows the one that fits data-season and data-theme.
const pseudo = (i: number) => {
  const v = Math.sin(i * 91.7 + 13.3) * 43758.5453;
  return v - Math.floor(v);
};
function pieces(kind: string, count: number, art: string, area: [number, number] = [0, 0]): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const r = (k: number) => pseudo(i * 7 + k + kind.length * 31);
    const style = [
      `left:${(r(1) * 100).toFixed(1)}%`,
      area[1] ? `top:${(area[0] + r(2) * (area[1] - area[0])).toFixed(1)}%` : '',
      `--d:${(-r(3) * 20).toFixed(1)}s`,
      `--t:${(1 + r(4) * 0.8).toFixed(2)}`,
      `--s:${(0.7 + r(5) * 0.6).toFixed(2)}`
    ].filter(Boolean).join(';');
    out += `<i style="${style}"><b>${art}</b></i>`;
  }
  return `<div class="fx fx-${kind}" aria-hidden="true">${out}</div>`;
}

const FLAKE = '<svg viewBox="-6 -6 12 12"><circle r="4" fill="var(--snow)" stroke="var(--ink)" stroke-width="1.2"/></svg>';
const PETAL = '<svg viewBox="-7 -5 14 10"><path d="M-6 0 C -3 -5, 4 -5, 6 -1 L4 0 L6 1 C 4 5, -3 5, -6 0 Z" fill="#ffc4d2" stroke="var(--ink)" stroke-width="1.1" stroke-linejoin="round"/></svg>';
const LEAF = '<svg viewBox="-8 -8 16 16"><path d="M-6 6 C -7 -2, -1 -7, 7 -7 C 7 1, 2 7, -6 6 Z M-6 6 L3 -3" fill="var(--leaf, #e9873e)" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const FIREFLY = '<svg viewBox="-6 -6 12 12"><circle r="5" fill="#f7f3a0" opacity=".35"/><circle r="2.2" fill="#fbf7c4"/></svg>';



export const SEASON_FX =
  pieces('snow', 22, FLAKE) +
  pieces('petal', 12, PETAL) +
  pieces('leaf', 9, LEAF) +
  pieces('firefly', 14, FIREFLY, [48, 88]);
