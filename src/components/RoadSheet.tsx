import { useState } from 'react';
import type { RoadNote, Weather } from '../types';
import { WEATHER_NAME } from '../types';
import { short, todayKey } from '../lib/dates';
import { addNote, deleteNote, toggleStar, updateNote } from '../lib/store';
import { StarIcon, WeatherIcon, WeatherPicker } from './Weather';
import { useToast } from './Toast';

interface Props {
  title: string;
  after: string | null;
  notes: RoadNote[];
  /** only the stretch you're walking now takes new notes */
  writable: boolean;
  onClose: () => void;
}

/** The dashed dot: things that happened between two sessions. */
export default function RoadSheet({ title, after, notes, writable, onClose }: Props) {
  const say = useToast();
  const [text, setText] = useState('');
  const [w, setW] = useState<Weather | null>(null);
  const [star, setStar] = useState(false);
  const [date, setDate] = useState(todayKey);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // oldest first, so the newest note is at the bottom
  const list = [...notes].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const starred = list.filter(n => n.star);
  const rest = list.filter(n => !n.star);

  const save = async () => {
    const t = text.trim();
    if (!t && !w) return say('寫一句，或點一個天氣');
    const landed = await addNote({ text: t, weather: w ?? undefined, star }, date);
    setText('');
    setW(null);
    setStar(false);
    say(landed === after ? '記下來了' : `記在 ${short(date)} 那段路上了`);
    setDate(todayKey());
  };

  const row = (n: RoadNote) =>
    editing === n.id ? (
      <NoteEditor
        key={n.id}
        note={n}
        onDone={async patch => {
          const landed = await updateNote(n.id, patch);
          setEditing(null);
          say(landed === n.after ? '改好了' : `改好了，移到 ${short(patch.date)} 那段路上`);
        }}
        onCancel={() => setEditing(null)}
      />
    ) : (
    <div className="entry" key={n.id}>
      {n.weather ? <WeatherIcon w={n.weather} className="w" /> : <svg className="w" aria-hidden="true" />}
      <div className="txt">
        <span>{short(n.date)}</span>
        {n.text ? n.text : <em>只記了天氣：{WEATHER_NAME[n.weather!]}</em>}
        {confirm === n.id ? (
          <div className="confirm">
            要刪掉這一則嗎？
            <button type="button" onClick={() => deleteNote(n.id)}>刪掉</button>
            <button type="button" onClick={() => setConfirm(null)}>不要</button>
          </div>
        ) : (
          <div className="row-links">
            <button className="linkish small" type="button" onClick={() => setEditing(n.id)}>修改</button>
            <button className="linkish small" type="button" onClick={() => setConfirm(n.id)}>刪除</button>
          </div>
        )}
      </div>
      <button className="star" type="button" aria-pressed={n.star} aria-label="想帶去說" onClick={() => toggleStar(n)}>
        <StarIcon />
      </button>
    </div>
  );

  return (
    <section className="sheet" role="dialog" aria-label="路上">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>關閉</button>
      </div>
      <div className="sheet-body">
        <h2 className="q">{title}</h2>
        {writable && (
          <>
            <p className="sub">兩次諮商之間的事。一句話、只點天氣，都可以。以前的事也能補記，選那天的日期，就會放到那段路上。</p>
            <div className="compose">
              <textarea id="road-text" className="field" placeholder="發生了什麼，或想到什麼" value={text} onChange={e => setText(e.target.value)} />
              <WeatherPicker small value={w} onChange={setW} />
              <label className="date-row">
                <span>日期</span>
                <input id="road-date" className="field" type="date" max={todayKey()} value={date} onChange={e => setDate(e.target.value || todayKey())} />
              </label>
              <div className="compose-row">
                <button className="star" type="button" aria-pressed={star} aria-label="想帶去說" onClick={() => setStar(!star)}>
                  <StarIcon />
                </button>
                <span className="tiny" style={{ flex: 1 }}>加星星，下次諮商前會拿出來給你看</span>
                <button className="pill sm" type="button" onClick={save}>記下來</button>
              </div>
            </div>
          </>
        )}
        {starred.length > 0 && (
          <>
            <div className="label">想帶去說的</div>
            <div className="entries">{starred.map(row)}</div>
          </>
        )}
        {rest.length > 0 && (
          <>
            {starred.length > 0 && <div className="label">其他</div>}
            <div className="entries">{rest.map(row)}</div>
          </>
        )}
        {!list.length && <p className="sub">這段路上還沒有記東西。</p>}
      </div>
    </section>
  );
}

/** Changing one road note: words, weather, date and star. */
function NoteEditor({ note, onDone, onCancel }: { note: RoadNote; onDone: (p: { text: string; weather?: Weather; star: boolean; date: string }) => void; onCancel: () => void }) {
  const say = useToast();
  const [text, setText] = useState(note.text);
  const [w, setW] = useState<Weather | null>(note.weather ?? null);
  const [date, setDate] = useState(note.date);
  const [star, setStar] = useState(note.star);
  return (
    <div className="compose editing">
      <textarea id={`edit-${note.id}`} className="field" value={text} onChange={e => setText(e.target.value)} placeholder="發生了什麼，或想到什麼" />
      <WeatherPicker small value={w} onChange={setW} />
      <label className="date-row">
        <span>日期</span>
        <input className="field" type="date" max={todayKey()} value={date} onChange={e => setDate(e.target.value || note.date)} />
      </label>
      <div className="compose-row">
        <button className="star" type="button" aria-pressed={star} aria-label="想帶去說" onClick={() => setStar(!star)}>
          <StarIcon />
        </button>
        <span style={{ flex: 1 }} />
        <button className="ghost" type="button" onClick={onCancel}>取消</button>
        <button
          className="pill sm"
          type="button"
          onClick={() => (text.trim() || w ? onDone({ text: text.trim(), weather: w ?? undefined, star, date }) : say('寫一句，或點一個天氣'))}
        >
          存好
        </button>
      </div>
    </div>
  );
}
