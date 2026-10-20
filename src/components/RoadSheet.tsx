import { useState } from 'react';
import type { RoadNote, Weather } from '../types';
import { WEATHER_NAME } from '../types';
import { short } from '../lib/dates';
import { addNote, deleteNote, toggleStar } from '../lib/store';
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
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = [...notes].sort((a, b) => b.createdAt - a.createdAt);
  const starred = list.filter(n => n.star);
  const rest = list.filter(n => !n.star);

  const save = async () => {
    const t = text.trim();
    if (!t && !w) return say('寫一句，或點一個天氣');
    await addNote(after, { text: t, weather: w ?? undefined, star });
    setText('');
    setW(null);
    setStar(false);
    say('記下來了');
  };

  const row = (n: RoadNote) => (
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
          <button className="linkish small" type="button" onClick={() => setConfirm(n.id)}>刪除</button>
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
            <p className="sub">兩次諮商之間的事。一句話、只點天氣，都可以。</p>
            <div className="compose">
              <textarea id="road-text" className="field" placeholder="發生了什麼，或想到什麼" value={text} onChange={e => setText(e.target.value)} />
              <WeatherPicker small value={w} onChange={setW} />
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
