// Static drawings shared by the whole app: weather icons, the still sky and drifting clouds.
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
