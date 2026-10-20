import { useState } from 'react';
import type { RoadNote, Session, Song } from '../types';
import { WEATHER_NAME } from '../types';
import { long, short, weekday } from '../lib/dates';
import { deleteSession } from '../lib/store';
import { groupByMonth } from '../lib/months';
import { WeatherIcon } from './Weather';
import { Cover, SongChip, SongPlayer } from './SongPicker';

/** 全部紀錄: every session, newest first; or the same road month by month. */
interface BookProps {
  sessions: Session[];
  notes: RoadNote[];
  onOpen: (s: Session) => void;
  onPlay: (s: Song) => void;
  onBackfill: () => void;
  onBackfillRoad: () => void;
  onSettings: () => void;
  onClose: () => void;
}

export function Book({ sessions, notes, onOpen, onPlay, onBackfill, onBackfillRoad, onSettings, onClose }: BookProps) {
  const [tab, setTab] = useState<'all' | 'months'>('all');
  const list = sessions.map((s, i) => ({ s, n: i + 1 })).reverse();
  return (
    <section className="sheet" role="dialog" aria-label="全部紀錄">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>回到小路</button>
        <button className="ghost" type="button" onClick={onSettings}>設定</button>
      </div>
      <div className="sheet-body">
        <h2 className="q">全部紀錄</h2>
        <div className="tabs-row" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>每一次</button>
          <button type="button" role="tab" aria-selected={tab === 'months'} onClick={() => setTab('months')}>每月回顧</button>
        </div>
        {tab === 'all' ? (
          <>
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
                  {s.song && <Cover song={s.song} small />}
                </button>
              ))}
            </div>
          </>
        ) : (
          <Months sessions={sessions} notes={notes} onOpen={onOpen} onPlay={onPlay} />
        )}
      </div>
    </section>
  );
}

/** 每月回顧: each month's weather, songs and the sentences you kept. */
function Months({ sessions, notes, onOpen, onPlay }: { sessions: Session[]; notes: RoadNote[]; onOpen: (s: Session) => void; onPlay: (s: Song) => void }) {
  const months = groupByMonth(sessions, notes);
  if (!months.length) return <p className="sub">還沒有紀錄。記了之後，這裡會照月份整理天氣、歌和記下的話。</p>;
  return (
    <div className="months">
      {months.map(m => (
        <article key={m.key} className="month">
          <h3>{m.title}</h3>
          <p className="tiny">
            {m.sessions.length} 次諮商{m.notes.length ? ` · 路上記了 ${m.notes.length} 件事` : ''}
          </p>
          {m.sessions.length > 0 && (
            <div className="month-weather">
              {m.sessions.map(s => (
                <button key={s.id} type="button" onClick={() => onOpen(s)} aria-label={`${long(s.date)}，${WEATHER_NAME[s.weather]}`}>
                  <WeatherIcon w={s.weather} />
                  <span>{short(s.date)}</span>
                </button>
              ))}
            </div>
          )}
          {m.songs.length > 0 && (
            <div>
              <div className="label">這個月的歌</div>
              <div className="results">
                {m.songs.map(x => (
                  <div key={x.key} className="month-song">
                    <span className="tiny">{short(x.date)}{x.road ? ' · 路上' : ''}</span>
                    <SongChip song={x.song} onPlay={() => onPlay(x.song)} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {m.quotes.length > 0 && (
            <div>
              <div className="label">記下的話</div>
              {m.quotes.map(q => (
                <blockquote key={q.id} className="quote small">「{q.quote.trim()}」<small>{short(q.date)}</small></blockquote>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
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
