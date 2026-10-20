import { useState } from 'react';
import type { RoadNote, Session } from '../types';
import { WEATHER_NAME } from '../types';
import { long, short, weekday } from '../lib/dates';
import { deleteSession } from '../lib/store';
import { WeatherIcon } from './Weather';
import { SongPlayer } from './SongPicker';

/** 全部紀錄: every session, newest first. */
interface BookProps {
  sessions: Session[];
  onOpen: (s: Session) => void;
  onBackfill: () => void;
  onBackfillRoad: () => void;
  onSettings: () => void;
  onClose: () => void;
}

export function Book({ sessions, onOpen, onBackfill, onBackfillRoad, onSettings, onClose }: BookProps) {
  const list = sessions.map((s, i) => ({ s, n: i + 1 })).reverse();
  return (
    <section className="sheet" role="dialog" aria-label="全部紀錄">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>回到小路</button>
        <button className="ghost" type="button" onClick={onSettings}>設定</button>
      </div>
      <div className="sheet-body">
        <h2 className="q">全部紀錄</h2>
        <div className="row-buttons">
          <button className="pill sm" type="button" onClick={onBackfill}>補記以前的諮商</button>
          <button className="pill sm" type="button" onClick={onBackfillRoad}>補記路上的事</button>
        </div>
        {!list.length && <p className="sub">還沒有紀錄。第一次諮商之後，按「記下今天」就會出現在這裡。</p>}
        <div className="book-list">
          {list.map(({ s, n }) => (
            <button key={s.id} className="book-row" type="button" onClick={() => onOpen(s)}>
              <WeatherIcon w={s.weather} className="w" />
              <div className="txt">
                <span>第 {n} 次 · {long(s.date)} {weekday(s.date)}{!s.done && ' · 還沒寫完'}</span>
                {s.quote.trim() ? <b>「{s.quote.trim()}」</b> : <b>{WEATHER_NAME[s.weather]}</b>}
                {(s.moods.length > 0 || s.topics.length > 0) && <small>{[...s.moods, ...s.topics].join('・')}</small>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** One session, in full. */
export function Detail({ session, n, roadBefore, onEdit, onClose }: { session: Session; n: number; roadBefore: RoadNote[]; onEdit: () => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const s = session;
  const starred = roadBefore.filter(r => r.star);
  return (
    <section className="sheet" role="dialog" aria-label={`第 ${n} 次諮商`}>
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>返回</button>
        <button className="ghost" type="button" onClick={onEdit}>{s.done ? '修改' : '補一點'}</button>
      </div>
      <div className="sheet-body">
        <div>
          <div className="label">第 {n} 次 · {weekday(s.date)}</div>
          <h2 className="q" style={{ marginTop: 4 }}>{long(s.date)}</h2>
        </div>
        <div className="detail-weather">
          <WeatherIcon w={s.weather} />
          <span>{WEATHER_NAME[s.weather]}</span>
        </div>
        {s.moods.length > 0 && (
          <div>
            <div className="label">心情</div>
            <div className="chips static">{s.moods.map(m => <span key={m} className="chip">{m}</span>)}</div>
          </div>
        )}
        {s.topics.length > 0 && (
          <div>
            <div className="label">談了什麼</div>
            <div className="chips static">{s.topics.map(m => <span key={m} className="chip">{m}</span>)}</div>
          </div>
        )}
        {s.quote.trim() && <blockquote className="quote">「{s.quote.trim()}」</blockquote>}
        {s.notes.trim() && <p className="notes">{s.notes}</p>}
        {s.song && (
          <div>
            <div className="label">這次的歌</div>
            <SongPlayer song={s.song} />
          </div>
        )}
        {starred.length > 0 && (
          <div>
            <div className="label">那時想帶去說的</div>
            <ul className="brought">{starred.map(r => <li key={r.id}>{short(r.date)}　{r.text || WEATHER_NAME[r.weather!]}</li>)}</ul>
          </div>
        )}
        <div className="danger">
          {confirm ? (
            <div className="confirm">
              刪掉這一次的紀錄？路上記的事會留著。
              <button type="button" onClick={() => deleteSession(s.id).then(onClose)}>刪掉</button>
              <button type="button" onClick={() => setConfirm(false)}>不要</button>
            </div>
          ) : (
            <button className="linkish small" type="button" onClick={() => setConfirm(true)}>刪除這一次</button>
          )}
        </div>
      </div>
    </section>
  );
}
