import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RoadNote, Session } from '../types';
import { WEATHER_NAME } from '../types';
import { long, short } from '../lib/dates';
import { AHEAD, blob, groundY, H, landMarkup, pathY, STEP, X0 } from '../lib/scenery';

interface Props {
  sessions: Session[];
  notes: RoadNote[];
  nextSession?: string;
  onOpenSession: (s: Session) => void;
  onOpenRoad: (after: string | null) => void;
  onNextSign: () => void;
}

type Picked = { kind: 'session'; i: number } | { kind: 'road'; after: string | null; x: number };

const dotX = (i: number) => X0 + i * STEP;

export default function Landscape({ sessions, notes, nextSession, onOpenSession, onOpenRoad, onNextSign }: Props) {
  const N = sessions.length;
  const walkerX = N ? dotX(N - 1) : X0 - 50;
  // the land always reaches past the right edge of the screen, even with only a few dots
  const [screen, setScreen] = useState({ w: innerWidth, h: innerHeight });
  const width = Math.max(walkerX + AHEAD, Math.ceil((screen.w * H) / Math.max(1, screen.h)) + 40);
  const land = useMemo(() => landMarkup(width, walkerX), [width, walkerX]);

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
    b.style.top = `${c.top - box.top - (onWalker ? 128 * scale() : 0)}px`;
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

  const sign = (x: number, text: string, w: number, onClick?: () => void) => {
    const y = groundY(x) + 6;
    return (
      <g className={onClick ? 'hit' : undefined} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? e => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined} aria-label={onClick ? `${text}，點一下設定下次諮商` : undefined}>
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

          {sign(X0 - 130, N ? `起點 ${short(sessions[0].date)}` : '起點', N ? 76 : 50)}
          {sign(walkerX + 200, nextSession ? `下次 ${short(nextSession)}` : '下次？', nextSession ? 86 : 60, onNextSign)}

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

          <g className="hit" tabIndex={0} role="button" aria-label={`現在這段路上，記了 ${curCount} 件事，點一下打開`}
            onClick={tap({ kind: 'road', after: current, x: rx })} onKeyDown={keys({ kind: 'road', after: current, x: rx })}>
            <circle cx={rx} cy={ry} r="30" fill="transparent" />
            <circle className="dot" cx={rx} cy={ry} r="13" fill="var(--paper)" fillOpacity=".75" stroke="var(--ink)" strokeWidth="2.5" strokeDasharray="5 5" />
            {curCount ? (
              <text className="lbl" x={rx} y={ry + 5} textAnchor="middle" style={{ fill: '#2c3a4b' }}>{curCount}</text>
            ) : (
              <path d={`M${rx - 5} ${ry} h10 M${rx} ${ry - 5} v10`} stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
            )}
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

          <Walker x={walkerX} />

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
              {sp.song && <span className="song">♪ {sp.song.name} · {sp.song.artists}</span>}
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

function Walker({ x }: { x: number }) {
  return (
    <g className="walker" style={{ transform: `translate(${x - 4}px, ${pathY(x) - 18}px)` }}>
      <g stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="2" cy="4" rx="22" ry="5" fill="var(--foot)" stroke="none" opacity=".6" />
        <g>
          <path d="M-8 -22 L-10 0 h9 L0 -22 Z" fill="var(--boot)" />
          <path d="M4 -22 L6 0 h9 L12 -22 Z" fill="var(--boot)" />
          <rect x="-26" y="-74" width="16" height="30" rx="6" fill="var(--pack)" />
          <path d="M-16 -22 C -20 -60, -14 -78, 2 -78 C 18 -78, 24 -60, 20 -22 Z" fill="var(--coat)" />
          <path d="M2 -60 C 14 -56, 18 -46, 22 -40" fill="none" />
          <circle cx="22" cy="-39" r="4" fill="var(--skin)" />
          <path d="M-12 -78 C -6 -72, 12 -72, 16 -78 L14 -86 C 6 -82, -6 -82, -12 -86 Z" fill="var(--scarf)" />
          <path d="M-10 -82 C -22 -80, -30 -74, -36 -70 L-32 -64 C -24 -70, -16 -72, -8 -76 Z" fill="var(--scarf)" />
          <circle cx="2" cy="-102" r="20" fill="var(--skin)" />
          <path d="M-18 -104 C -18 -126, 20 -128, 22 -104 C 14 -112, -2 -114, -18 -104 Z" fill="var(--boot)" />
          <circle cx="12" cy="-100" r="2.2" fill="var(--ink)" stroke="none" />
          <circle cx="14" cy="-92" r="4" fill="var(--cheek)" stroke="none" opacity=".8" />
          <path d="M17 -88 q3 2 5 0" fill="none" strokeWidth="2" />
        </g>
      </g>
    </g>
  );
}
