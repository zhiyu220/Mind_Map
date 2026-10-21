import { useState } from 'react';
import type { RoadNote, Session, Song } from '../types';
import { WEATHER_NAME } from '../types';
import { long, short, weekday } from '../lib/dates';
import { deleteSession } from '../lib/store';
import { groupByMonth, recordYears, skyOfYear, topicsUsed } from '../lib/months';
import { WeatherIcon } from './Weather';
import { Cover, SongChip, SongPlayer } from './SongPicker';

export type BookTab = 'all' | 'months' | 'year' | 'quotes';

const TABS: [BookTab, string][] = [['all', '每一次'], ['months', '每月'], ['year', '這一年'], ['quotes', '記下的話']];

/** 全部紀錄: every session, newest first; the same road month by month, as a year of sky, or just the sentences. */
interface BookProps {
  sessions: Session[];
  notes: RoadNote[];
  tab: BookTab;
  /** 照主題回看: only the sessions that talked about this */
  topic: string | null;
  onTab: (t: BookTab) => void;
  onTopic: (t: string | null) => void;
  onOpen: (s: Session) => void;
  onPlay: (s: Song) => void;
  onBackfill: () => void;
  onBackfillRoad: () => void;
  onSettings: () => void;
  onClose: () => void;
}

export function Book({ sessions, notes, tab, topic, onTab, onTopic, onOpen, onPlay, onBackfill, onBackfillRoad, onSettings, onClose }: BookProps) {
  const topics = topicsUsed(sessions);
  const list = sessions
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => !topic || s.topics.includes(topic))
    .reverse();
  return (
    <section className="sheet" role="dialog" aria-label="全部紀錄">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>回到小路</button>
        <button className="ghost" type="button" onClick={onSettings}>設定</button>
      </div>
      <div className="sheet-body">
        <h2 className="q">全部紀錄</h2>
        <div className="tabs-row" role="tablist">
          {TABS.map(([k, name]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => onTab(k)}>{name}</button>
          ))}
        </div>
        {tab === 'all' ? (
          <>
            <div className="row-buttons">
              <button className="pill sm" type="button" onClick={onBackfill}>補記以前的諮商</button>
              <button className="pill sm" type="button" onClick={onBackfillRoad}>補記路上的事</button>
            </div>
            {topics.length > 0 && (
              <div className="topic-filter">
                <div className="label">照主題回看</div>
                <div className="chips small">
                  {topics.map(t => (
                    <button key={t} className="chip" type="button" aria-pressed={topic === t} onClick={() => onTopic(topic === t ? null : t)}>{t}</button>
                  ))}
                </div>
                {topic && <p className="tiny">談過「{topic}」的 {list.length} 次，最近的在上面。再點一次就看全部。</p>}
              </div>
            )}
            {!sessions.length && <p className="sub">還沒有紀錄。第一次諮商之後，按「記下今天」就會出現在這裡。</p>}
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
        ) : tab === 'months' ? (
          <Months sessions={sessions} notes={notes} onOpen={onOpen} onPlay={onPlay} />
        ) : tab === 'year' ? (
          <YearSky sessions={sessions} notes={notes} onOpen={onOpen} />
        ) : (
          <Quotes sessions={sessions} notes={notes} onOpen={onOpen} />
        )}
      </div>
    </section>
  );
}

/** 這一年的天空: each month's weather side by side, so the seasons of the road show at a glance. */
function YearSky({ sessions, notes, onOpen }: { sessions: Session[]; notes: RoadNote[]; onOpen: (s: Session) => void }) {
  const years = recordYears(sessions, notes);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  if (!years.length) return <p className="sub">還沒有紀錄。記了之後，這裡會把一整年的天氣排在一起。</p>;
  const i = years.indexOf(year);
  const months = skyOfYear(year, sessions, notes);
  return (
    <div className="year">
      <div className="year-head">
        <button className="ghost" type="button" disabled={i >= years.length - 1} onClick={() => setYear(years[i + 1])} aria-label="前一年">‹</button>
        <h3>{year} 年的天空</h3>
        <button className="ghost" type="button" disabled={i <= 0} onClick={() => setYear(years[i - 1])} aria-label="後一年">›</button>
      </div>
      <div className="year-grid">
        {months.map(m => (
          <div key={m.month} className="year-row">
            <span className="year-m">{m.month}月</span>
            <div className="year-cells">
              {m.sessions.map(s => (
                <button key={s.id} type="button" className={`sky-cell w-${s.weather}`} onClick={() => onOpen(s)} aria-label={`${long(s.date)}，${WEATHER_NAME[s.weather]}`}>
                  <WeatherIcon w={s.weather} />
                </button>
              ))}
              {m.road.map((w, k) => (
                <i key={k} className={`road-cell w-${w}`} title={`路上：${WEATHER_NAME[w]}`} />
              ))}
              {!m.sessions.length && !m.road.length && <span className="year-empty" />}
            </div>
          </div>
        ))}
      </div>
      <p className="tiny">大的是諮商那天的天氣，小圓點是路上記的天氣。點一下大的，可以看那一次。</p>
    </div>
  );
}

/** 記下的話: every sentence you kept, to leaf through on a hard day. */
function Quotes({ sessions, notes, onOpen }: { sessions: Session[]; notes: RoadNote[]; onOpen: (s: Session) => void }) {
  const kept = sessions.filter(s => s.quote.trim()).reverse();
  const [pick, setPick] = useState<Session | null>(null);
  const [together, setTogether] = useState(false);
  if (!kept.length) return <p className="sub">還沒有記下的話。記錄時「印象最深的一句話」會收在這裡。</p>;
  if (together) return <Together sessions={sessions} notes={notes} onClose={() => setTogether(false)} />;
  const another = () => {
    const rest = kept.filter(s => s !== pick);
    setPick(rest[Math.floor(Math.random() * rest.length)] ?? kept[0]);
  };
  return (
    <div className="quotes">
      {pick ? (
        <button className="quote-card" type="button" onClick={another} aria-label="再翻一句">
          <span>「{pick.quote.trim()}」</span>
          <small>{long(pick.date)} 記下的 · 點一下再翻一句</small>
        </button>
      ) : (
        <div className="row-buttons">
          {kept.length > 1 && <button className="pill sm" type="button" onClick={another}>隨手翻一句</button>}
          <button className="pill sm" type="button" onClick={() => setTogether(true)}>放在一起看</button>
        </div>
      )}
      {kept.map(s => (
        <button key={s.id} className="quote-row" type="button" onClick={() => onOpen(s)}>
          <blockquote className="quote small">「{s.quote.trim()}」<small>{long(s.date)}</small></blockquote>
        </button>
      ))}
    </div>
  );
}

/**
 * 放在一起看: something the counsellor said, next to something you wrote, both picked by you.
 * Nothing is paired for you and there's no arrow between them: it's not a before and after.
 * Only for looking; a thought it brings goes in through the lamp on the road.
 */
function Together({ sessions, notes, onClose }: { sessions: Session[]; notes: RoadNote[]; onClose: () => void }) {
  const said = sessions.filter(s => s.quote.trim());
  const mine = [
    ...sessions.flatMap(s => [
      s.raw && { key: `raw-${s.id}`, text: s.raw, date: s.date },
      s.notes.trim() && { key: `notes-${s.id}`, text: s.notes.trim(), date: s.date },
      s.takeHome && { key: `home-${s.id}`, text: s.takeHome, date: s.date }
    ]),
    ...notes.filter(n => n.text.trim()).map(n => ({ key: `note-${n.id}`, text: n.text.trim(), date: n.date }))
  ]
    .filter((x): x is { key: string; text: string; date: string } => !!x)
    .sort((a, b) => a.date.localeCompare(b.date));
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const l = said.find(s => s.id === left);
  const r = mine.find(m => m.key === right);
  const cut = (t: string) => (t.length > 24 ? `${t.slice(0, 24)}…` : t);
  return (
    <div className="together">
      <button className="linkish small" type="button" onClick={onClose}>回到記下的話</button>
      <p className="sub">下雨的日子也在路上。</p>
      <div className="compare">
        <label>
          <small>心理師說過的</small>
          <select className="field" value={left} onChange={e => setLeft(e.target.value)}>
            <option value="">選一句</option>
            {said.map(s => <option key={s.id} value={s.id}>{short(s.date)}　{cut(s.quote.trim())}</option>)}
          </select>
          {l && <blockquote className="quote small">「{l.quote.trim()}」<small>{long(l.date)}</small></blockquote>}
        </label>
        <label>
          <small>我自己寫的</small>
          <select className="field" value={right} onChange={e => setRight(e.target.value)}>
            <option value="">選一句</option>
            {mine.map(m => <option key={m.key} value={m.key}>{short(m.date)}　{cut(m.text)}</option>)}
          </select>
          {r && <blockquote className="quote small found">{r.text}<small>{long(r.date)}</small></blockquote>}
        </label>
      </div>
    </div>
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
export function Detail({ session, n, roadBefore, onEdit, onTopic, onClose }: { session: Session; n: number; roadBefore: RoadNote[]; onEdit: () => void; onTopic: (t: string) => void; onClose: () => void }) {
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
            <div className="label">談了什麼 · 點一下看其他談過的</div>
            <div className="chips static">{s.topics.map(m => <button key={m} type="button" className="chip" onClick={() => onTopic(m)}>{m}</button>)}</div>
          </div>
        )}
        {s.raw && (
          <div>
            <div className="label">剛結束的時候</div>
            <p className="notes">{s.raw}</p>
          </div>
        )}
        {s.quote.trim() && <blockquote className="quote">「{s.quote.trim()}」</blockquote>}
        {s.notes.trim() && <p className="notes">{s.notes}</p>}
        {s.takeHome && (
          <div>
            <div className="label">想帶回家的一句</div>
            <p className="notes">{s.takeHome}</p>
          </div>
        )}
        {s.leave && (
          <div>
            <div className="label">先留在諮商室的{s.bringLeave ? ' · 下次要帶去' : ''}</div>
            <p className="notes">{s.leave}</p>
          </div>
        )}
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
