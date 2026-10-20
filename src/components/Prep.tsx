import type { Practice, RoadNote, Session } from '../types';
import { WEATHER_NAME } from '../types';
import { countdown, long, short } from '../lib/dates';
import { WeatherIcon } from './Weather';
import { Sprouts } from './Practices';

interface Props {
  sessions: Session[];
  /** the notes on the stretch you're walking now */
  road: RoadNote[];
  practices: Practice[];
  today: string;
  nextSession?: string;
  onOpenRoad: () => void;
  onClose: () => void;
}

/** 去說說話之前: a look back at this stretch of road, so you know what you'd like to say. */
export default function Prep({ sessions, road, practices, today, nextSession, onOpenRoad, onClose }: Props) {
  const last = sessions[sessions.length - 1];
  const quoted = [...sessions].reverse().find(s => s.quote.trim());
  const notes = [...road].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const starred = notes.filter(n => n.star);
  const weathers = notes.filter(n => n.weather);
  const since = last?.date ?? '';
  const tried = practices.filter(p => !p.archived).map(p => ({ p, tries: p.tries.filter(d => d > since) }));
  const c = countdown(today, nextSession);

  return (
    <section className="sheet" role="dialog" aria-label="去說說話之前">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>回到小路</button>
      </div>
      <div className="sheet-body prep">
        <div>
          {c && <div className="label">{c.big === '就是今天' ? '今天' : c.big} · {c.small}</div>}
          <h2 className="q" style={{ marginTop: 4 }}>去說說話之前</h2>
        </div>

        {quoted && (
          <div>
            <div className="label">{quoted === last ? '上次記下的一句話' : `${short(quoted.date)} 記下的一句話`}</div>
            <blockquote className="quote">「{quoted.quote.trim()}」</blockquote>
          </div>
        )}

        <div>
          <div className="label">想帶去說的</div>
          {starred.length ? (
            <ul className="brought">
              {starred.map(n => (
                <li key={n.id}>
                  <span className="tiny">{short(n.date)}</span>　{n.text || WEATHER_NAME[n.weather!]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="tiny">這段路上還沒有加星星的事。</p>
          )}
          <button className="linkish small" type="button" onClick={onOpenRoad}>
            {starred.length ? '打開路上，再加一點' : '打開路上，寫下想說的'}
          </button>
        </div>

        {(last || weathers.length > 0) && (
          <div>
            <div className="label">{last ? `${short(last.date)} 之後的天氣` : '這段日子的天氣'}</div>
            <div className="prep-weather">
              {last && (
                <span className="prep-w first" title={`${long(last.date)}，${WEATHER_NAME[last.weather]}`}>
                  <WeatherIcon w={last.weather} />
                  <small>{short(last.date)}</small>
                </span>
              )}
              {weathers.map(n => (
                <span key={n.id} className="prep-w" title={`${long(n.date)}，${WEATHER_NAME[n.weather!]}`}>
                  <WeatherIcon w={n.weather!} />
                  <small>{short(n.date)}</small>
                </span>
              ))}
              {!weathers.length && <span className="tiny">路上還沒記天氣。</span>}
            </div>
          </div>
        )}

        {tried.length > 0 && (
          <div>
            <div className="label">想練習的事</div>
            <ul className="brought">
              {tried.map(({ p, tries }) => (
                <li key={p.id} className="prep-practice">
                  {p.text}
                  <Sprouts tries={tries} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
