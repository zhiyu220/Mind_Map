import { useEffect, useState } from 'react';
import type { DayFields, Practice, RoadNote, Song } from '../types';
import { MOODS, WEATHER_NAME } from '../types';
import { long, short, todayKey, weekday } from '../lib/dates';
import { deleteNote, getDay, saveDay } from '../lib/store';
import { focusInPlace } from '../lib/viewport';
import { WeatherIcon, WeatherPicker } from './Weather';
import { useToast } from './Toast';
import SongPicker, { SongChip } from './SongPicker';
import Practices from './Practices';

interface Props {
  title: string;
  after: string | null;
  notes: RoadNote[];
  /** only the stretch you're walking now takes new pages */
  writable: boolean;
  /** opened to write today: start in the page, and close quietly once it's saved */
  quick?: boolean;
  /** start with a page open (but no keyboard yet); otherwise it opens with 寫今天, so looking doesn't bring up the keyboard */
  write?: boolean;
  practices: Practice[];
  onPlay: (s: Song) => void;
  onClose: () => void;
}

/** The parts of a day's page, in the order they're written and shown. */
const PARTS = [
  ['happened', '今天發生了什麼'],
  ['felt', '心裡的感覺'],
  ['text', '其他想寫的']
] as const;

/** The dashed dot: the days between two sessions, one diary page a day. */
export default function RoadSheet({ title, after, notes, writable, quick, write, practices, onPlay, onClose }: Props) {
  const say = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  // the page open for writing: a day (today, or one being changed), or none while just looking
  const [open, setOpen] = useState<{ date: string; fixed: boolean; focus: boolean } | null>(
    quick || write ? { date: todayKey(), fixed: false, focus: !!quick } : null
  );
  // oldest first, so the newest day is at the bottom
  const days = [...notes].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const today = days.find(n => n.date === todayKey());

  const saved = (landed: string | null, date: string) => {
    // written for today from 記下今天: back to the road, with no count and no comfort, just a quiet end
    if (quick && landed === after) {
      onClose();
      return say('先放在這裡');
    }
    say(landed === after ? '記下來了' : `記在 ${short(date)} 那段路上了`);
    setOpen(write ? { date: todayKey(), fixed: false, focus: false } : null);
  };

  const page = (n: RoadNote) =>
    open?.fixed && open.date === n.date ? (
      <DayEditor key={n.id} date={n.date} fixed focus={false} onSaved={saved} onCancel={() => setOpen(null)} />
    ) : (
      <article className="day" key={n.id}>
        <header>
          {n.weather ? <WeatherIcon w={n.weather} className="w" /> : <svg className="w" aria-hidden="true" />}
          <span className="day-date">{short(n.date)} {weekday(n.date)}</span>
        </header>
        {n.moods && n.moods.length > 0 && <div className="chips static">{n.moods.map(m => <span key={m} className="chip">{m}</span>)}</div>}
        {PARTS.filter(([k]) => n[k]?.trim()).map(([k, label], _i, shown) => (
          <div key={k}>
            {/* a page from before the diary had parts is just its words */}
            {!(k === 'text' && shown.length === 1) && <div className="label">{label}</div>}
            <p className="notes">{n[k]}</p>
          </div>
        ))}
        {!n.happened?.trim() && !n.felt?.trim() && !n.text.trim() && n.weather && <p className="tiny">只記了天氣：{WEATHER_NAME[n.weather]}</p>}
        {n.song && <SongChip song={n.song} onPlay={() => onPlay(n.song!)} />}
        {confirm === n.id ? (
          <div className="confirm">
            要刪掉 {short(n.date)} 這一篇嗎？
            <button type="button" onClick={() => deleteNote(n.id)}>刪掉</button>
            <button type="button" onClick={() => setConfirm(null)}>不要</button>
          </div>
        ) : (
          <div className="row-links">
            <button className="linkish small" type="button" onClick={() => setOpen({ date: n.date, fixed: true, focus: false })}>修改</button>
            <button className="linkish small" type="button" onClick={() => setConfirm(n.id)}>刪除</button>
          </div>
        )}
      </article>
    );

  return (
    <section className="sheet" role="dialog" aria-label="路上">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>關閉</button>
      </div>
      <div className="sheet-body">
        <h2 className="q">{title}</h2>
        {writable && !open && (
          <button className="pill sm write-one" type="button" onClick={() => setOpen({ date: todayKey(), fixed: false, focus: true })}>
            {today ? '繼續寫今天' : '寫今天'}
          </button>
        )}
        {writable && open && !open.fixed && (
          <>
            <p className="sub">一天一篇，兩次諮商之間的日記。每一格都可以空著。以前的日子也能補寫，選那天的日期，就會放到那段路上。</p>
            <DayEditor date={open.date} focus={open.focus} onSaved={saved} onCancel={quick || write ? undefined : () => setOpen(null)} />
          </>
        )}
        {writable && <Practices practices={practices} />}
        {days.length > 0 && <div className="days">{days.map(page)}</div>}
        {!days.length && <p className="sub">這段路上還沒有寫東西。</p>}
      </div>
    </section>
  );
}

/**
 * A day's page: weather, moods, the three parts and a song. Picking another date opens that day's page
 * (written before, it's there to go on with). fixed: changing a page already on the list, its date stays.
 */
function DayEditor({ date: start, fixed, focus, onSaved, onCancel }: { date: string; fixed?: boolean; focus: boolean; onSaved: (landed: string | null, date: string) => void; onCancel?: () => void }) {
  const say = useToast();
  const [date, setDate] = useState(start);
  const [d, setD] = useState<Partial<DayFields>>({});
  const [ready, setReady] = useState(false);
  const set = (patch: Partial<DayFields>) => setD(cur => ({ ...cur, ...patch }));

  useEffect(() => {
    let on = true;
    setReady(false);
    getDay(date).then(n => {
      if (!on) return;
      setD(n ? { weather: n.weather, moods: n.moods, happened: n.happened, felt: n.felt, text: n.text, song: n.song } : {});
      setReady(true);
    });
    return () => void (on = false);
  }, [date]);

  const save = async () => {
    const page = { ...d, text: d.text?.trim() ?? '', happened: d.happened?.trim() || undefined, felt: d.felt?.trim() || undefined };
    if (!page.text && !page.happened && !page.felt && !page.weather && !page.moods?.length && !page.song) return say('寫一點、點一個天氣，或選一個心情');
    const { note } = await saveDay(page, date);
    onSaved(note.after, date);
  };

  return (
    <div className="compose diary">
      {!fixed ? (
        <label className="date-row">
          <span>日期</span>
          <input id="road-date" className="field" type="date" max={todayKey()} value={date} onChange={e => setDate(e.target.value || todayKey())} />
        </label>
      ) : (
        <div className="label">{long(date)}</div>
      )}
      <div className="label">天氣</div>
      <WeatherPicker small value={d.weather ?? null} onChange={w => set({ weather: w ?? undefined })} />
      <div className="label">心情</div>
      <div className="chips small">
        {MOODS.map(m => (
          <button key={m} className="chip" type="button" aria-pressed={!!d.moods?.includes(m)}
            onClick={() => set({ moods: d.moods?.includes(m) ? d.moods.filter(x => x !== m) : [...(d.moods ?? []), m] })}>
            {m}
          </button>
        ))}
      </div>
      {PARTS.map(([k, label], i) => (
        <label key={k} className="part">
          <span className="label">{label}</span>
          <textarea
            id={k === 'happened' ? 'road-text' : `day-${k}`}
            className="field"
            value={d[k] ?? ''}
            onChange={e => set({ [k]: e.target.value })}
            ref={i === 0 && focus ? focusInPlace : undefined}
          />
        </label>
      ))}
      <NoteSong key={date + String(ready)} value={d.song} onChange={song => set({ song })} />
      <div className="compose-row">
        {onCancel ? <button className="ghost" type="button" onClick={onCancel}>{fixed ? '取消' : '先不寫'}</button> : <span />}
        <button className="pill sm" type="button" disabled={!ready} onClick={save}>記下來</button>
      </div>
    </div>
  );
}

/** "♪ 加一首歌" on a day's page: opens the same song picker as a session day. */
function NoteSong({ value, onChange }: { value?: Song; onChange: (s: Song | undefined) => void }) {
  const [open, setOpen] = useState(!!value);
  if (!open) {
    return (
      <button className="linkish" type="button" onClick={() => setOpen(true)}>
        ♪ 加一首歌
      </button>
    );
  }
  return (
    <div className="note-song">
      <SongPicker value={value} onChange={onChange} />
      <button className="linkish small" type="button" onClick={() => (onChange(undefined), setOpen(false))}>
        不加歌了
      </button>
    </div>
  );
}

