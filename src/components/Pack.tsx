import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PackItem, RoadNote, Session } from '../types';
import { MOOD_FAMILIES } from '../lib/moods';
import { short, todayKey } from '../lib/dates';
import { addToPack, deleteFromPack, movePack } from '../lib/store';
import { useToast } from './Toast';
import { WeatherIcon } from './Weather';

/** The dot by each mood family's name in the backpack, heavy to light. */
const FAMILY_COLOR: Record<string, string> = {
  沉沉的: '#8da0b3', 緊緊的: '#c7913d', 刺刺的: '#d9785f', 霧霧的: '#a59cc0', 輕輕的: '#86b98f', 暖暖的: '#e3a25a', 亮亮的: '#f0cc4a', 身體: '#b79a82'
};

/** The groups of the backpack, in order: the mood families, then 路燈, then what isn't in one yet. */
export const GROUPS = [
  ...MOOD_FAMILIES.map(f => ({ id: f.name as string | undefined, name: f.name, color: FAMILY_COLOR[f.name] ?? '#c9bfae' })),
  { id: 'lamp', name: '路燈旁想到的', color: '#e8c45a' },
  { id: undefined, name: '還沒分的', color: 'transparent' }
];
export const groupName = (id?: string) => GROUPS.find(g => g.id === id)?.name ?? '還沒分的';

const PART_NAME = { happened: '今天發生了什麼', felt: '心裡的感覺', text: '其他想寫的' } as const;

/** Where a sentence came from, under it: 「11/19 日記 · 心裡的感覺」 */
export const fromLine = (p: PackItem) =>
  `${short(p.date)} ${p.from === 'diary' ? `日記${p.part ? ` · ${PART_NAME[p.part]}` : ''}` : p.from === 'found' ? '後來我發現' : '自己寫的'}`;

/** Marks words that can go into the backpack: select some of them, and 「放進背包」 shows up. */
export const packable = (from: 'diary' | 'found', date: string, part?: PackItem['part'], moods?: string[]) => ({
  'data-pack': from,
  'data-pack-date': date,
  'data-pack-part': part,
  'data-pack-moods': moods?.join(',')
});

const BagIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
    <path d="M9 9V7a3 3 0 0 1 6 0v2" />
  </svg>
);

/**
 * 「放進背包」 under the words you've selected, inside `root`. The words keep where they came from:
 * the day, the part of the page, and that day's moods, which decide the group.
 */
export function PackPicker({ root }: { root: RefObject<HTMLElement | null> }) {
  const say = useToast();
  const [at, setAt] = useState<{ x: number; y: number; text: string; el: HTMLElement } | null>(null);
  const gone = useRef<number>(undefined);

  useEffect(() => {
    const look = () => {
      const sel = document.getSelection();
      const text = sel && !sel.isCollapsed && sel.rangeCount ? sel.toString().trim() : '';
      const range = text ? sel!.getRangeAt(0) : null;
      const node = range?.commonAncestorContainer;
      const el = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>('[data-pack]');
      clearTimeout(gone.current);
      if (!range || !el || !root.current?.contains(el)) {
        // a tap on the button clears the selection first: wait a moment so the tap still lands
        gone.current = window.setTimeout(() => setAt(null), 300);
        return;
      }
      const r = range.getBoundingClientRect();
      setAt({ x: Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70), y: Math.min(r.bottom + 10, window.innerHeight - 60), text, el });
    };
    document.addEventListener('selectionchange', look);
    document.addEventListener('scroll', look, true);
    return () => {
      document.removeEventListener('selectionchange', look);
      document.removeEventListener('scroll', look, true);
      clearTimeout(gone.current);
    };
  }, [root]);

  if (!at) return null;
  const put = async () => {
    const { el, text } = at;
    setAt(null);
    document.getSelection()?.removeAllRanges();
    const item = await addToPack(
      { text, from: el.dataset.pack as 'diary' | 'found', date: el.dataset.packDate ?? todayKey(), part: (el.dataset.packPart as PackItem['part']) || undefined },
      el.dataset.packMoods?.split(',').filter(Boolean)
    );
    say(item.group ? `放進背包了，放在「${groupName(item.group)}」` : '放進背包了', () => deleteFromPack(item.id));
  };
  return (
    <button className="pack-pop" type="button" style={{ left: at.x, top: at.y }} onMouseDown={e => e.preventDefault()} onClick={put}>
      <BagIcon />
      放進背包
    </button>
  );
}

/** 想帶去說: the backpack. Grouped by the mood of the day each sentence came from, or in the order they went in. */
export function PackSheet({ items, todayMoods, onClose }: { items: PackItem[]; todayMoods?: string[]; onClose: () => void }) {
  const [order, setOrder] = useState<'mood' | 'time'>('mood');
  const [moving, setMoving] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const say = useToast();
  const byTime = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  const card = (p: PackItem) => (
    <li key={p.id} className="pack-item">
      <span className="pack-text">{p.text}</span>
      <small>{fromLine(p)}{order === 'time' && p.group ? ` · ${groupName(p.group)}` : ''}</small>
      {moving === p.id ? (
        <div className="chips small" role="group" aria-label="換到哪一格">
          {GROUPS.map(g => (
            <button key={g.id ?? 'none'} className="chip" type="button" aria-pressed={p.group === g.id}
              onClick={async () => (await movePack(p.id, g.id), setMoving(null))}>
              {g.name}
            </button>
          ))}
        </div>
      ) : confirm === p.id ? (
        <div className="confirm">
          從背包拿出來？
          <button type="button" onClick={() => (deleteFromPack(p.id), setConfirm(null))}>拿出來</button>
          <button type="button" onClick={() => setConfirm(null)}>不要</button>
        </div>
      ) : (
        <div className="row-links">
          <button className="linkish small" type="button" onClick={() => setMoving(p.id)}>換一格</button>
          <button className="linkish small" type="button" onClick={() => setConfirm(p.id)}>拿出來</button>
        </div>
      )}
    </li>
  );

  const add = async () => {
    if (!text.trim()) return;
    const item = await addToPack({ text, from: 'own', date: todayKey() }, todayMoods);
    setText('');
    setWriting(false);
    say(item.group ? `放進背包了，放在「${groupName(item.group)}」` : '放進背包了');
  };

  return (
    <section className="sheet" role="dialog" aria-label="想帶去說">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>關閉</button>
      </div>
      <div className="sheet-body pack">
        <h2 className="q">想帶去說</h2>
        <p className="sub">在日記裡選一段字，就能放進來。也可以直接寫。</p>
        {items.length > 0 && (
          <div className="seg" role="radiogroup" aria-label="怎麼排">
            <button type="button" role="radio" aria-checked={order === 'mood'} onClick={() => setOrder('mood')}>依心情</button>
            <button type="button" role="radio" aria-checked={order === 'time'} onClick={() => setOrder('time')}>依時間</button>
          </div>
        )}
        {order === 'mood' ? (
          GROUPS.map(g => {
            const list = byTime.filter(p => p.group === g.id || (!g.id && !GROUPS.some(x => x.id && x.id === p.group)));
            return list.length ? (
              <div key={g.id ?? 'none'} className="pack-group">
                <div className="pack-group-name"><i style={{ background: g.color }} />{g.name}</div>
                <ul className="pack-list">{list.map(card)}</ul>
              </div>
            ) : null;
          })
        ) : (
          <ul className="pack-list">{byTime.map(card)}</ul>
        )}
        {!items.length && !writing && <p className="tiny">背包還是空的。</p>}
        {writing ? (
          <div className="compose">
            <textarea id="pack-text" className="field" autoFocus placeholder="想跟諮商師說的……" value={text} onChange={e => setText(e.target.value)} />
            <div className="compose-row">
              <button className="ghost" type="button" onClick={() => (setWriting(false), setText(''))}>先不寫</button>
              <button className="pill sm" type="button" disabled={!text.trim()} onClick={add}>放進去</button>
            </div>
          </div>
        ) : (
          <button className="linkish" type="button" onClick={() => setWriting(true)}>＋ 自己寫一句</button>
        )}
        <p className="tiny">諮商那天存完紀錄，勾了要帶去的會自己收起來，不用一個一個刪掉。</p>
      </div>
    </section>
  );
}

/**
 * 拿給諮商師看: only what was ticked, large, on a plain page. Nothing else can be reached from here,
 * and nothing is saved as a file.
 */
export function ShowSheet({ lines, last, road, onClose }: { lines: string[]; last?: Session; road: RoadNote[]; onClose: () => void }) {
  const weathers = [...road].sort((a, b) => a.date.localeCompare(b.date)).filter(n => n.weather);
  return (
    <section className="sheet show" role="dialog" aria-label="這次想說的">
      <div className="sheet-body">
        <div>
          {last && <div className="label">{short(last.date)} 之後的這段路</div>}
          <h2 className="q" style={{ marginTop: 4 }}>這次想說的</h2>
        </div>
        {weathers.length > 0 && (
          <div className="show-weather" aria-hidden="true">
            {weathers.map(n => <WeatherIcon key={n.id} w={n.weather!} />)}
          </div>
        )}
        <ol className="show-list">
          {lines.map((t, i) => (
            <li key={i}>
              <span className="n">{i + 1}</span>
              <p>{t}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="sheet-foot center">
        <button className="pill" type="button" onClick={onClose}>看完了，還給我</button>
      </div>
    </section>
  );
}
