import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { PackItem, Practice, RoadNote, Session } from '../types';
import { chooseLeave, choosePack, leaveChosen } from '../lib/store';
import { fromLine } from './Pack';
import { WEATHER_NAME } from '../types';
import { firstLine } from './Book';
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
  /** what's in the backpack now */
  pack: PackItem[];
  onOpenRoad: () => void;
  onOpenPack: () => void;
  /** 拿給諮商師看, with the ticked sentences */
  onShow: (lines: string[]) => void;
  onClose: () => void;
}

/** 去說說話之前: a look back at this stretch of road, so you know what you'd like to say. */
export default function Prep({ sessions, road, practices, today, nextSession, pack, onOpenRoad, onOpenPack, onShow, onClose }: Props) {
  const last = sessions[sessions.length - 1];
  const quoted = [...sessions].reverse().find(s => s.quote.trim());
  const notes = [...road].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const written = notes.filter(n => firstLine(n));
  const weathers = notes.filter(n => n.weather);
  const since = last?.date ?? '';
  const tried = practices.filter(p => !p.archived).map(p => ({ p, tries: p.tries.filter(d => d > since) }));
  const c = countdown(today, nextSession);
  const leave = last?.bringLeave && last.leave?.trim() ? last.leave.trim() : null;
  // ticks show at once; the database catches up a moment later
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const tick = (id: string, on: boolean) => setTicks(t => ({ ...t, [id]: on }));
  const savedLeave = useLiveQuery(leaveChosen, []);
  const leaveOn = !!leave && (ticks.leave ?? savedLeave === last?.id);
  const items = [...pack].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const isOn = (p: PackItem) => ticks[p.id] ?? !!p.chosen;
  const chosen = [...(leaveOn ? [leave!] : []), ...items.filter(isOn).map(p => p.text)];

  return (
    <section className="sheet" role="dialog" aria-label="去說說話之前">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>回到小路</button>
      </div>
      <div className="sheet-body prep">
        <div>
          {c && <div className="label">{c.big === '就是今天' ? '今天' : c.big} · {c.small}</div>}
          <h2 className="q" style={{ marginTop: 4 }}>去說說話之前</h2>
          <p className="sub" style={{ margin: "8px 0 0" }}>打開背包看看。不用全部說，挑一個就好。</p>
        </div>

        <div className="prep-box">
          <div className="label">想帶去說 · 勾想說的</div>
          {leave || items.length ? (
            <ul className="pack-check">
              {leave && (
                <li>
                  <label className="toggle">
                    <input type="checkbox" checked={leaveOn} onChange={e => (tick('leave', e.target.checked), chooseLeave(e.target.checked ? last!.id : null))} />
                    <span>{leave}<small>上次留在諮商室、說好要帶來的</small></span>
                  </label>
                </li>
              )}
              {items.map(p => (
                <li key={p.id}>
                  <label className="toggle">
                    <input type="checkbox" checked={isOn(p)} onChange={e => (tick(p.id, e.target.checked), choosePack(p.id, e.target.checked))} />
                    <span>{p.text}<small>{fromLine(p)}</small></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tiny">背包還是空的。在日記裡選一段字，按「放進背包」。</p>
          )}
          <button className="linkish small" type="button" onClick={onOpenPack}>打開背包，再放一句</button>
        </div>

        {quoted && (
          <div className="prep-box">
            <div className="label">{quoted === last ? '上次記下的一句話' : `${short(quoted.date)} 記下的一句話`}</div>
            <blockquote className="quote">「{quoted.quote.trim()}」</blockquote>
          </div>
        )}


        <div className="prep-box">
          {/* no count: a number makes it feel like a list still to get through */}
          <div className="label">這段路上的日記</div>
          {written.length ? (
            <ul className="brought prep-list">
              {written.map(n => (
                <li key={n.id}>
                  <span className="tiny">{short(n.date)}</span>
                  <span>{firstLine(n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tiny">這段路上還沒有寫日記。</p>
          )}
          <button className="linkish small" type="button" onClick={onOpenRoad}>
            打開路上，看看每一天
          </button>
        </div>

        {(last || weathers.length > 0) && (
          <div className="prep-box">
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
          <div className="prep-box">
            <div className="label">想練習的事 · 試的時候發生了什麼？</div>
            <ul className="brought">
              {tried.map(({ p, tries }) => (
                <li key={p.id} className="prep-practice">
                  <span>{p.text}</span>
                  {/* only the latest sprout: not a record of how often, just that you tried */}
                  <Sprouts tries={tries.slice(-1)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {chosen.length > 0 && (
        <div className="sheet-foot center">
          <button className="pill" type="button" onClick={() => onShow(chosen)}>拿給諮商師看（{chosen.length} 則）</button>
          <small className="tiny">只顯示勾起來的，不會存成檔案</small>
        </div>
      )}
    </section>
  );
}
