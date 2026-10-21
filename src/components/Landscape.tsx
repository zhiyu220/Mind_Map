import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RoadNote, Session, Song } from '../types';
import { WEATHER_NAME } from '../types';
import { SongChip } from './SongPicker';
import { long, short } from '../lib/dates';
import { AHEAD, blob, groundY, H, landMarkup, HOUSE_X, pathY, STEP, X0 } from '../lib/scenery';

interface Props {
  sessions: Session[];
  notes: RoadNote[];
  nextSession?: string;
  onOpenSession: (s: Session) => void;
  onOpenRoad: (after: string | null) => void;
  onNextSign: () => void;
  onPlay: (s: Song) => void;
  look: 'girl' | 'boy';
}

type Picked = { kind: 'session'; i: number } | { kind: 'road'; after: string | null; x: number };

const dotX = (i: number) => X0 + i * STEP;

export default function Landscape({ sessions, notes, nextSession, onOpenSession, onOpenRoad, onNextSign, onPlay, look }: Props) {
  const N = sessions.length;
  const walkerX = N ? dotX(N - 1) : X0 - 50;
  // the land always reaches past the right edge of the screen, even with only a few dots
  const [screen, setScreen] = useState({ w: innerWidth, h: innerHeight });
  const width = Math.max(walkerX + AHEAD, Math.ceil((screen.w * H) / Math.max(1, screen.h)) + 40);
  const land = useMemo(() => landMarkup(width, walkerX, N), [width, walkerX, N]);

  const world = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  const scale = () => (svg.current ? svg.current.getBoundingClientRect().height / H : 1);
  const goHome = (smooth: boolean) =>
    world.current?.scrollTo({ left: walkerX * scale() - world.current.clientWidth * 0.55, behavior: smooth ? 'smooth' : 'auto' });

  // open on the walker; glide along when a new dot is added
  const firstScroll = useRef(true);
  useLayoutEffect(() => {
    goHome(!firstScroll.current);
    firstScroll.current = false;
    setPicked(null);
  }, [walkerX]);
  useEffect(() => {
    const r = () => {
      setScreen({ w: innerWidth, h: innerHeight });
      goHome(false);
    };
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  });

  // notes grouped by the stretch of road they belong to
  const byStretch = useMemo(() => {
    const m = new Map<string | null, RoadNote[]>();
    for (const n of notes) m.set(n.after, [...(m.get(n.after) ?? []), n]);
    return m;
  }, [notes]);
  const current = N ? sessions[N - 1].id : null;
  const pastRoads: { after: string | null; x: number; count: number }[] = [];
  if (N) {
    const before = byStretch.get(null);
    if (before?.length) pastRoads.push({ after: null, x: X0 - 50, count: before.length });
    sessions.slice(0, -1).forEach((s, i) => {
      const list = byStretch.get(s.id);
      if (list?.length) pastRoads.push({ after: s.id, x: dotX(i) + STEP / 2, count: list.length });
    });
  }
  const curCount = byStretch.get(current)?.length ?? 0;
  const rx = walkerX + 100, ry = pathY(rx);

  // keep the speech bubble on its dot while the land scrolls
  const place = () => {
    const b = bubble.current, g = svg.current?.querySelector('.hit.on .dot');
    if (!b || !g || !page.current) return;
    const c = g.getBoundingClientRect(), box = page.current.getBoundingClientRect();
    const half = b.offsetWidth / 2, cx = c.left + c.width / 2 - box.left;
    const x = Math.max(half + 12, Math.min(box.width - half - 12, cx));
    const onWalker = picked?.kind === 'session' && picked.i === N - 1;
    b.style.left = `${x}px`;
    b.style.top = `${c.top - box.top - (onWalker ? 136 * scale() : 0)}px`;
    b.style.setProperty('--tip', `${Math.max(20, Math.min(b.offsetWidth - 20, cx - x + half))}px`);
    b.style.visibility = cx < -20 || cx > box.width + 20 ? 'hidden' : 'visible';
  };
  useLayoutEffect(place);

  const tap = (p: Picked) => (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (p.kind === 'road' && p.after === current && p.x === rx) return onOpenRoad(current);
    setPicked(cur => (cur && JSON.stringify(cur) === JSON.stringify(p) ? null : p));
  };
  const keys = (p: Picked) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tap(p)(e);
    }
  };
  const isOn = (p: Picked) => !!picked && JSON.stringify(picked) === JSON.stringify(p);

  // the signs carry just a word; the dates live in the line at the top and the sheets (and the label below)
  const sign = (x: number, text: string, w: number, onClick?: () => void, label = text) => {
    const y = groundY(x) + 6;
    return (
      <g className={onClick ? 'hit' : undefined} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? e => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined} aria-label={onClick ? `${label}，點一下設定下次諮商` : undefined}>
        <g stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round">
          <path d={`M${x} ${y + 30} v-44`} stroke="var(--fence)" strokeWidth="5" />
          <rect x={x - w / 2} y={y - 40} width={w} height="26" rx="5" fill="var(--paper)" />
        </g>
        <text className="lbl" x={x} y={y - 22} textAnchor="middle" style={{ fill: '#2c3a4b' }}>{text}</text>
      </g>
    );
  };

  const sp = picked?.kind === 'session' ? sessions[picked.i] : null;

  return (
    <div ref={page} className="landscape">
      <div className="world" ref={world} onScroll={place}>
        <svg ref={svg} viewBox={`0 0 ${width} ${H}`} style={{ aspectRatio: `${width} / ${H}` }} onClick={() => setPicked(null)}
          role="img" aria-label="一條往右延伸的小路，實心圓點是每一次諮商，虛線圓點是兩次諮商之間的路上">
          <defs>
            <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
              <line x1="0" y1="0" x2="0" y2="9" stroke="var(--ink)" strokeWidth="1.2" opacity=".09" />
            </pattern>
          </defs>
          <g dangerouslySetInnerHTML={{ __html: land.back }} />

          {sign(HOUSE_X, '起點', 50)}
          {sign(walkerX + 200, nextSession ? '下次' : '下次？', nextSession ? 50 : 60, onNextSign, nextSession ? `下次 ${short(nextSession)}` : '下次？')}

          {pastRoads.map(r => {
            const p: Picked = { kind: 'road', after: r.after, x: r.x };
            return (
              <g key={`r${r.after}`} className={`hit${isOn(p) ? ' on' : ''}`} tabIndex={0} role="button" aria-label={`路上，記了 ${r.count} 件事`}
                onClick={tap(p)} onKeyDown={keys(p)}>
                <circle cx={r.x} cy={pathY(r.x)} r="22" fill="transparent" />
                <circle className="dot" cx={r.x} cy={pathY(r.x)} r="8" fill="var(--paper)" fillOpacity=".7" stroke="var(--ink)" strokeWidth="2.2" strokeDasharray="4 4" />
              </g>
            );
          })}

          {/* today's stretch: a small pen, one tap to write down what you just thought of (no count shown) */}
          <g className="hit" tabIndex={0} role="button" aria-label={curCount ? '現在這段路上，點一下寫下來，或看看記過的' : '現在這段路上，點一下寫下來'}
            onClick={tap({ kind: 'road', after: current, x: rx })} onKeyDown={keys({ kind: 'road', after: current, x: rx })}>
            <circle cx={rx} cy={ry} r="30" fill="transparent" />
            <circle className="dot" cx={rx} cy={ry} r="13" fill="var(--paper)" fillOpacity=".75" stroke="var(--ink)" strokeWidth="2.5" strokeDasharray="5 5" />
            <g stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
              <path d={`M${rx - 6} ${ry + 6} l1.4 -4.4 l7.6 -7.6 l3 3 l-7.6 7.6 Z`} fill="var(--scarf)" />
              <path d={`M${rx - 4.6} ${ry + 1.6} l3 3`} fill="none" />
            </g>
            <text className="lbl" x={rx} y={ry + 34} textAnchor="middle">路上</text>
          </g>

          {sessions.map((s, i) => {
            const x = dotX(i), y = pathY(x), p: Picked = { kind: 'session', i };
            return (
              <g key={s.id} className={`hit${isOn(p) ? ' on' : ''}`} tabIndex={0} role="button"
                aria-label={`第 ${i + 1} 次諮商，${long(s.date)}，${WEATHER_NAME[s.weather]}`} onClick={tap(p)} onKeyDown={keys(p)}>
                <circle cx={x} cy={y} r="30" fill="transparent" />
                <path className="dot" d={blob(x, y, 15)} fill={`var(--w-${s.weather})`} stroke="var(--ink)" strokeWidth="2.5"
                  strokeDasharray={s.done ? undefined : '6 4'} />
                <text className="lbl" x={x} y={y + 36} textAnchor="middle">{short(s.date)}</text>
              </g>
            );
          })}

          <Walker x={walkerX} look={look} />

          <g dangerouslySetInnerHTML={{ __html: land.front }} />
        </svg>
        {/* the butterfly is its own little layer, so its flight never repaints the land */}
        <div className="butterfly" aria-hidden="true"
          style={{ left: (walkerX + 160) * (screen.h / H), top: (pathY(walkerX) - 130) * (screen.h / H) }}>
          <svg viewBox="-18 -14 36 20">
            <path d="M0 0 C -10 -12, -16 -2, -8 4 Z" fill="var(--f1)" stroke="var(--ink)" strokeWidth="1.6" />
            <path d="M0 0 C 10 -12, 16 -2, 8 4 Z" fill="var(--f1)" stroke="var(--ink)" strokeWidth="1.6" />
          </svg>
        </div>
      </div>

      {picked && (
        <div className="bubble" ref={bubble} onClick={e => e.stopPropagation()}>
          {sp ? (
            <>
              <b>第 {picked.kind === 'session' ? picked.i + 1 : ''} 次 · {long(sp.date)}</b>
              {WEATHER_NAME[sp.weather]}
              {!sp.done && '，還沒寫完'}
              {sp.song && <SongChip song={sp.song} onPlay={() => (setPicked(null), onPlay(sp.song!))} />}
              <button type="button" onClick={() => (setPicked(null), onOpenSession(sp))}>{sp.done ? '看這一次的紀錄' : '看看，或補一點'}</button>
            </>
          ) : picked.kind === 'road' ? (
            <>
              <b>路上 · {picked.after ? `${short(sessions.find(s => s.id === picked.after)!.date)} 之後` : '第一次之前'}</b>
              記了 {byStretch.get(picked.after)?.length ?? 0} 件事
              <button type="button" onClick={() => (setPicked(null), onOpenRoad(picked.after))}>打開看看</button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** The walker, side on, facing the road ahead. Clothes follow the season (styles.css sets the colours,
 *  .s-* and .no-* pieces show only in their season); `look` picks the girl or the boy. */
function Walker({ x, look }: { x: number; look: 'girl' | 'boy' }) {
  const girl = look === 'girl';
  // limbs are an ink stroke with a narrower colour stroke on top, so they read as outlined shapes
  const limb = (d: string, color: string, w = 8) => (
    <>
      <path d={d} stroke="var(--ink)" strokeWidth={w + 5} fill="none" />
      <path d={d} stroke={color} strokeWidth={w} fill="none" />
    </>
  );
  return (
    <g className="walker" style={{ transform: `translate(${x - 4}px, ${pathY(x) - 18}px)` }}>
      <g stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="4" cy="3" rx="26" ry="5" fill="var(--foot)" stroke="none" opacity=".6" />

        {/* legs: trousers or tights above, and below the knee whatever the season leaves bare */}
        {limb('M-5 -34 L-7 -8', 'var(--pants)', 9)}
        {limb('M-6 -18 L-7 -8', 'var(--shin)', 9)}
        {limb('M9 -34 L11 -8', 'var(--pants)', 9)}
        {limb('M10 -18 L11 -8', 'var(--shin)', 9)}
        <path d="M-14 -8 h12 c6 0 9 3 9 8 h-21 Z" fill="var(--boot)" />
        <path d="M4 -8 h12 c7 0 11 3 11 8 h-23 Z" fill="var(--boot)" />
        <path className="s-winter" d="M-14 -6 h21 M4 -6 h23" strokeWidth="2" fill="none" />

        {/* backpack */}
        <rect x="-32" y="-84" width="20" height="38" rx="8" fill="var(--pack)" />
        <rect x="-30" y="-64" width="13" height="11" rx="3" fill="var(--pack)" />
        <path d="M-31 -74 C -26 -70, -18 -70, -13 -74" fill="none" strokeWidth="2" />

        {/* long hair falls behind the shoulders */}
        {girl && <path d="M-18 -106 C -26 -86, -24 -70, -14 -64 C -6 -61, 0 -66, 2 -76 L 2 -98 Z" fill="var(--hair)" />}

        {/* coat, sweater or T-shirt; the girl's flares a little at the hem */}
        <path d={girl ? 'M-16 -30 C -16 -58, -14 -80, 4 -80 C 20 -80, 24 -58, 26 -30 Z' : 'M-14 -34 C -18 -60, -14 -80, 4 -80 C 20 -80, 24 -60, 22 -34 Z'} fill="var(--coat)" />
        <path className="no-summer" d="M8 -78 V-36" fill="none" strokeWidth="2" />
        <g className="no-summer" fill="var(--ink)" stroke="none"><circle cx="12" cy="-66" r="1.8" /><circle cx="12" cy="-54" r="1.8" /></g>
        <path className="s-summer" d="M-4 -78 C 0 -72, 8 -72, 12 -78" fill="none" strokeWidth="2" />
        <path className="s-summer" d="M9 -60 c -2 -4 -7 -2 -4 2 l4 4 l4 -4 c 3 -4 -2 -6 -4 -2 Z" fill="var(--f1)" strokeWidth="1.5" />
        <path className="s-winter" d="M-15 -62 C -2 -59, 12 -59, 23 -62 M-15 -48 C -2 -45, 12 -45, 23 -48" fill="none" strokeWidth="2" />
        <path className="s-autumn" d={girl ? 'M-15 -36 C -2 -33, 12 -33, 25 -36' : 'M-14 -40 C -2 -37, 12 -37, 22 -40'} fill="none" strokeWidth="2" />
        <path d="M14 -46 h8 v7 h-8 z" fill="none" strokeWidth="2" className="no-summer" />

        {/* the front arm, holding the backpack strap */}
        {limb('M8 -72 L15 -57', 'var(--coat)')}
        {limb('M15 -57 L22 -48', 'var(--forearm)')}
        <circle cx="23" cy="-46" r="4.6" fill="var(--hand)" />

        {/* scarf: blowing back most of the year, hanging long in winter, off in summer */}
        <g className="no-summer">
          <path d="M-10 -79 C -4 -73, 13 -73, 18 -79 L16 -87 C 8 -83, -4 -83, -10 -87 Z" fill="var(--scarf)" />
          <path className="no-winter" d="M-8 -83 C -20 -81, -28 -75, -34 -71 L-30 -65 C -22 -71, -14 -73, -6 -77 Z" fill="var(--scarf)" />
          <path className="s-winter" d="M11 -79 C 13 -69, 13 -61, 11 -54 L18 -54 C 20 -62, 20 -71, 17 -79 Z" fill="var(--scarf)" />
        </g>

        {/* head */}
        <path d="M0 -86 v6 h8 v-6" fill="var(--skin)" />
        <circle cx="4" cy="-102" r="21" fill="var(--skin)" />
        {girl ? (
          <>
            <path d="M-17 -98 C -21 -128, 22 -133, 26 -106 C 19 -110, 11 -112, 7 -117 C 4 -110, -4 -109, -8 -102 C -10 -96, -14 -94, -17 -98 Z" fill="var(--hair)" />
            <circle cx="11" cy="-119" r="3.4" fill="var(--f1)" strokeWidth="1.6" />
          </>
        ) : (
          <path d="M-18 -98 C -22 -127, 20 -133, 26 -108 C 21 -111, 17 -109, 15 -114 C 11 -108, 5 -110, 3 -115 C -1 -107, -7 -105, -9 -97 C -12 -94, -15 -94, -18 -98 Z" fill="var(--hair)" />
        )}
        {!girl && <path d="M-3 -100 c -5 0 -6 8 0 8" fill="var(--skin)" strokeWidth="2" />}
        <path d="M11 -109 q3 -2.5 7 0" fill="none" strokeWidth="2" />
        <ellipse cx="15" cy="-101" rx="2.2" ry="3" fill="var(--ink)" stroke="none" />
        <circle cx="15.8" cy="-102.4" r=".9" fill="#fff" stroke="none" />
        <ellipse cx="16" cy="-93" rx="4.2" ry="2.6" fill="var(--cheek)" stroke="none" opacity=".8" />
        <path d="M19 -89 q3 2 5.5 -.5" fill="none" strokeWidth="2" />

        {/* summer: a straw hat; autumn: a beret; winter: a knitted hat with a pompom */}
        <g className="s-summer">
          <path d="M-14 -113 C -14 -136, 22 -136, 22 -113 Z" fill="#f3d58b" />
          <path d="M-13 -117 h34" stroke="#e0664f" strokeWidth="4" />
          <ellipse cx="4" cy="-113" rx="31" ry="6" fill="#f3d58b" />
        </g>
        <g className="s-autumn">
          <path d="M-20 -111 C -22 -130, 20 -136, 28 -115 C 18 -111, -6 -109, -20 -111 Z" fill="#9b3d4a" />
          <path d="M4 -127 l1 -6" />
        </g>
        <g className="s-winter">
          <path d="M-17 -109 C -19 -136, 25 -136, 25 -109 Z" fill="var(--scarf)" />
          <path d="M-6 -112 v-14 M4 -112 v-17 M14 -112 v-14" fill="none" strokeWidth="1.6" />
          <rect x="-20" y="-114" width="48" height="9" rx="4.5" fill="var(--paper)" />
          <circle cx="4" cy="-134" r="6" fill="var(--paper)" />
        </g>
      </g>
    </g>
  );
}
