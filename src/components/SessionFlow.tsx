import { useEffect, useState } from 'react';
import type { Session, Song, Weather } from '../types';
import { MOODS, TOPICS } from '../types';
import { headerDate, todayKey } from '../lib/dates';
import { WeatherPicker } from './Weather';
import SongPicker from './SongPicker';

export type Draft = Pick<Session, 'moods' | 'topics' | 'quote' | 'notes'> & { weather: Weather | null; song?: Song; date?: string };

/** today: a new record for today; past: filling in an earlier session; edit: changing one */
export type FlowMode = 'today' | 'past' | 'edit';

const STEPS = ['weather', 'mood', 'topic', 'quote', 'notes', 'song'] as const;
const DATED_STEPS = ['date', ...STEPS] as const;
const DRAFT_KEY = 'my-sky:draft';

export const emptyDraft = (): Draft => ({ weather: null, moods: [], topics: [], quote: '', notes: '' });

/** A draft survives the app being closed halfway (only for new records, not edits). */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage may be unavailable */
  }
}

interface Props {
  initial: Draft;
  mode: FlowMode;
  /** dates that already have a session, to mention it when picking a day */
  takenDates?: string[];
  customTopics: string[];
  onAddTopic: (t: string) => void;
  onSave: (d: Draft & { weather: Weather }, done: boolean) => void;
  onClose: () => void;
}

/** Recording a session day: one question per page; only the weather is needed. */
export default function SessionFlow({ initial, mode, takenDates = [], customTopics, onAddTopic, onSave, onClose }: Props) {
  const editing = mode === 'edit';
  const past = mode === 'past' || (editing && !!initial.date && initial.date !== todayKey());
  const steps: readonly string[] = mode === 'today' ? STEPS : DATED_STEPS;
  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const k = steps[step];
  const today = todayKey();
  const set = (patch: Partial<Draft>) => setD(cur => ({ ...cur, ...patch }));
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  useEffect(() => {
    if (mode !== 'today') return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* storage may be unavailable */
    }
  }, [d, mode]);

  const save = (done: boolean) => {
    if (!d.weather || (steps.includes('date') && !d.date)) return onClose();
    onSave({ ...d, weather: d.weather }, done);
  };
  const last = step === steps.length - 1;
  const next = () => (last ? save(true) : setStep(step + 1));
  const canGo = k === 'date' ? !!d.date && d.date <= today : k === 'weather' ? !!d.weather : true;
  const topics = [...TOPICS, ...customTopics, ...d.topics.filter(t => !TOPICS.includes(t) && !customTopics.includes(t))];

  return (
    <section className="sheet" role="dialog" aria-label={mode === 'past' ? '補記以前的諮商' : editing ? '修改紀錄' : '記錄今天的諮商'}>
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={() => save(editing || last)}>
          {d.weather ? (editing ? '存起來' : '先存起來') : '關閉'}
        </button>
        <div className="progress" aria-label={`第 ${step + 1} 題，共 ${steps.length} 題`}>
          {steps.map((_, i) => (
            <i key={i} className={i < step ? 'done' : i === step ? 'now' : ''} />
          ))}
        </div>
        <button className="ghost" type="button" onClick={() => setStep(step - 1)} style={{ visibility: step ? 'visible' : 'hidden' }}>
          上一題
        </button>
      </div>

      <div className="sheet-body" key={k}>
        {k === 'date' && (
          <>
            <h2 className="q">{editing ? '是哪一天？' : '是哪一天的諮商？'}</h2>
            <p className="sub">{editing ? '記錯天的話可以改。' : '記不太清楚也沒關係，只有天氣要選，其他都能跳過。'}</p>
            <input id="session-date" className="field" type="date" max={today} value={d.date ?? ''} onChange={e => set({ date: e.target.value || undefined })} />
            {d.date && <p className="tiny">{headerDate(d.date)}{d.date !== initial.date && takenDates.includes(d.date) ? '：這天已經有一筆紀錄了，還是可以再記一筆。' : ''}</p>}
          </>
        )}
        {k === 'weather' && (
          <>
            <h2 className="q">{past ? '那天的天氣是？' : '今天的天氣是？'}</h2>
            <p className="sub">選一個最接近的就好。</p>
            <WeatherPicker value={d.weather} onChange={w => set({ weather: w })} />
          </>
        )}
        {k === 'mood' && (
          <>
            <h2 className="q">{past ? '那時的心情' : '現在的心情'}</h2>
            <p className="sub">可以選很多個。</p>
            <div className="chips">
              {MOODS.map(m => (
                <button key={m} className="chip" type="button" aria-pressed={d.moods.includes(m)} onClick={() => set({ moods: toggle(d.moods, m) })}>
                  {m}
                </button>
              ))}
            </div>
          </>
        )}
        {k === 'topic' && (
          <>
            <h2 className="q">{past ? '那天談了什麼？' : '今天談了什麼？'}</h2>
            <div className="chips">
              {topics.map(t => (
                <button key={t} className="chip" type="button" aria-pressed={d.topics.includes(t)} onClick={() => set({ topics: toggle(d.topics, t) })}>
                  {t}
                </button>
              ))}
              <button className="chip add" type="button" onClick={() => setAdding(true)}>＋ 自己寫</button>
            </div>
            {adding && (
              <form
                className="addrow"
                onSubmit={e => {
                  e.preventDefault();
                  const v = newTopic.trim();
                  if (v) {
                    if (!topics.includes(v)) onAddTopic(v);
                    if (!d.topics.includes(v)) set({ topics: [...d.topics, v] });
                  }
                  setNewTopic('');
                  setAdding(false);
                }}
              >
                <input id="topic-new" className="field" autoFocus maxLength={12} placeholder="例如：搬家" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                <button className="pill sm" type="submit">加入</button>
              </form>
            )}
          </>
        )}
        {k === 'quote' && (
          <>
            <h2 className="q">印象最深的一句話</h2>
            <textarea id="quote" className="field" placeholder="記得的那句話" value={d.quote} onChange={e => set({ quote: e.target.value })} />
          </>
        )}
        {k === 'notes' && (
          <>
            <h2 className="q">還想寫點什麼嗎？</h2>
            <textarea id="notes" className="field tall" value={d.notes} onChange={e => set({ notes: e.target.value })} />
          </>
        )}
        {k === 'song' && (
          <>
            <h2 className="q">這次的歌</h2>
            <SongPicker value={d.song} onChange={song => set({ song })} />
          </>
        )}
      </div>

      <div className="sheet-foot">
        {k === 'date' ? (
          <span />
        ) : k === 'weather' ? (
          // only the weather is needed: once it's chosen, that's a whole record, not an unfinished one
          d.weather && !editing ? <button className="ghost" type="button" onClick={() => save(true)}>這樣就好</button> : <span />
        ) : (
          <button className="ghost" type="button" onClick={next}>跳過</button>
        )}
        <button className="pill" type="button" disabled={!canGo} onClick={next}>
          {last ? '完成' : '下一題'}
        </button>
      </div>
    </section>
  );
}
