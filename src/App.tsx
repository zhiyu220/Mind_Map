import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, getSettings, saveSettings } from './db';
import type { Session } from './types';
import { DEFS, SKY } from './drawings';
import { countdown, headerDate, short, todayKey } from './lib/dates';
import { homeLines, lineOfTheDay } from './lib/lines';
import { addSession, byDate, updateSession } from './lib/store';
import { playlistUris, syncPlaylist } from './lib/spotify';
import Landscape from './components/Landscape';
import SessionFlow, { clearDraft, emptyDraft, loadDraft, type Draft } from './components/SessionFlow';
import RoadSheet from './components/RoadSheet';
import { Book, Detail } from './components/Book';
import Settings, { NextSessionField } from './components/Settings';
import Lock from './components/Lock';
import { ToastProvider, useToast } from './components/Toast';

type View =
  | { kind: 'ask' }
  | { kind: 'flow'; edit?: Session; past?: boolean }
  | { kind: 'road'; after: string | null }
  | { kind: 'book' }
  | { kind: 'detail'; id: string }
  | { kind: 'settings' }
  | { kind: 'next' };

const RELOCK_AFTER = 60_000;

export default function App() {
  return (
    <ToastProvider>
      <div dangerouslySetInnerHTML={{ __html: DEFS }} />
      <Main />
    </ToastProvider>
  );
}

function Main() {
  const say = useToast();
  const sessions = useLiveQuery(async () => (await db.sessions.toArray()).sort(byDate), []);
  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const loaded = useLiveQuery(getSettings, []);
  const settings = loaded ?? DEFAULT_SETTINGS;
  const [view, setView] = useState<View | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [lineIdx, setLineIdx] = useState<number | null>(null);
  const [today, setToday] = useState(todayKey);

  // lock again after the app has been in the background for a while; notice a new day
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else {
        if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER) setUnlocked(false);
        setToday(todayKey());
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // with no lock set, stay open (setting a PIN now locks from the next time on)
  useEffect(() => {
    if (loaded && !loaded.pinHash) setUnlocked(true);
  }, [loaded]);

  // the 「我的天空」 playlist follows the road: any added, changed or removed song updates it
  const songKey = useMemo(() => (sessions ? playlistUris(sessions).join(',') : null), [sessions]);
  useEffect(() => {
    if (songKey === null || loaded?.spotifyPlaylist === false) return;
    const t = setTimeout(() => syncPlaylist(songKey ? songKey.split(',') : []).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [songKey, loaded?.spotifyPlaylist]);

  const lines = useMemo(() => homeLines(sessions ?? [], notes ?? [], today, settings.nextSession), [sessions, notes, today, settings.nextSession]);

  if (!sessions || !notes || !loaded) return <div className="page" />;
  if (settings.pinHash && !unlocked) return <Lock pinHash={settings.pinHash} onUnlock={() => setUnlocked(true)} />;

  const current = sessions.length ? sessions[sessions.length - 1].id : null;
  const roadOf = (after: string | null) => notes.filter(n => n.after === after);
  const line = lines[(lineIdx ?? lineOfTheDay(lines, today)) % Math.max(1, lines.length)];
  const close = () => setView(null);
  const todaySession = sessions.find(s => s.date === today);

  const saveFlow = async (d: Draft & { weather: NonNullable<Draft['weather']> }, done: boolean, edit?: Session, past?: boolean) => {
    const { weather, moods, topics, quote, notes: text, song, date } = d;
    if (edit) {
      await updateSession(edit.id, { weather, moods, topics, quote, notes: text, song, date: date ?? edit.date, done: edit.done || done });
      setView({ kind: 'detail', id: edit.id });
      say('改好了');
    } else if (past && date) {
      const s = await addSession({ weather, moods, topics, quote, notes: text, song }, done, date);
      setLineIdx(null);
      setView({ kind: 'detail', id: s.id });
      say(`補記好了，放在 ${short(date)} 的位置`);
    } else {
      await addSession({ weather, moods, topics, quote, notes: text, song }, done);
      clearDraft();
      setLineIdx(null);
      close();
      say(done ? '存好了' : '先存起來了，想補的時候再點那個點');
    }
  };

  let sheet = null;
  if (view?.kind === 'ask') {
    const stars = roadOf(current).filter(n => n.star).length;
    sheet = (
      <>
        <div className="scrim" onClick={close} />
        <div className="ask" role="dialog" aria-label="記下今天">
          <h3>今天有去諮商嗎？</h3>
          {todaySession ? (
            <button className="big" type="button" onClick={() => setView({ kind: 'flow', edit: todaySession })}>
              <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill={`var(--w-${todaySession.weather})`} stroke="var(--ink)" strokeWidth="2.5" /></svg>
              <span>今天已經記了一次<small>回去修改或補一點</small></span>
            </button>
          ) : (
            <button className="big" type="button" onClick={() => setView({ kind: 'flow' })}>
              <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill="var(--w-partly)" stroke="var(--ink)" strokeWidth="2.5" /></svg>
              <span>有，今天去了<small>在路上放一個新的點</small></span>
            </button>
          )}
          <button className="big" type="button" onClick={() => setView({ kind: 'road', after: current })}>
            <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill="none" stroke="var(--sheet-ink)" strokeWidth="2.5" strokeDasharray="5 5" /></svg>
            <span>沒有，記在路上<small>{stars ? `路上有 ${stars} 件加了星星的事` : '兩次諮商之間的事'}</small></span>
          </button>
        </div>
      </>
    );
  } else if (view?.kind === 'flow') {
    const { edit: e, past } = view;
    sheet = (
      <SessionFlow
        initial={
          e
            ? { weather: e.weather, moods: e.moods, topics: e.topics, quote: e.quote, notes: e.notes, song: e.song, date: e.date }
            : past
              ? emptyDraft()
              : (loadDraft() ?? emptyDraft())
        }
        mode={e ? 'edit' : past ? 'past' : 'today'}
        takenDates={sessions.map(s => s.date)}
        customTopics={settings.customTopics}
        onAddTopic={t => saveSettings({ customTopics: [...settings.customTopics, t] })}
        onSave={(d, done) => saveFlow(d, done, e, past)}
        onClose={() => (e ? setView({ kind: 'detail', id: e.id }) : past ? setView({ kind: 'book' }) : (clearDraft(), close()))}
      />
    );
  } else if (view?.kind === 'road') {
    const i = sessions.findIndex(s => s.id === view.after);
    const title = view.after ? `路上 · ${short(sessions[i].date)} 之後` : sessions.length ? '路上 · 第一次之前' : '路上 · 出發之前';
    sheet = <RoadSheet title={title} after={view.after} notes={roadOf(view.after)} writable={view.after === current} onClose={close} />;
  } else if (view?.kind === 'book') {
    sheet = (
      <Book
        sessions={sessions}
        onOpen={s => setView({ kind: 'detail', id: s.id })}
        onBackfill={() => setView({ kind: 'flow', past: true })}
        onBackfillRoad={() => setView({ kind: 'road', after: current })}
        onSettings={() => setView({ kind: 'settings' })}
        onClose={close}
      />
    );
  } else if (view?.kind === 'detail') {
    const i = sessions.findIndex(s => s.id === view.id);
    if (i >= 0)
      sheet = (
        <Detail
          session={sessions[i]}
          n={i + 1}
          roadBefore={roadOf(i ? sessions[i - 1].id : null)}
          onEdit={() => setView({ kind: 'flow', edit: sessions[i] })}
          onClose={() => setView({ kind: 'book' })}
        />
      );
  } else if (view?.kind === 'settings') {
    sheet = <Settings settings={settings} onClose={() => setView({ kind: 'book' })} />;
  } else if (view?.kind === 'next') {
    sheet = (
      <>
        <div className="scrim" onClick={close} />
        <div className="ask" role="dialog" aria-label="下次諮商">
          {(() => {
            const c = countdown(today, settings.nextSession);
            return c ? (
              <div className="countdown">
                <b>{c.big}</b>
                <span>{c.small}</span>
                <small>要改日期的話：</small>
              </div>
            ) : (
              <h3>下次諮商是哪一天？</h3>
            );
          })()}
          <NextSessionField value={settings.nextSession} onDone={close} />
        </div>
      </>
    );
  }

  return (
    <div className="page">
      {/* hidden and still under a full-page sheet, so typing doesn't compete with the landscape */}
      <div className={`home${sheet && view?.kind !== 'ask' && view?.kind !== 'next' ? ' covered' : ''}`} inert={!!sheet}>
      <div dangerouslySetInnerHTML={{ __html: SKY }} style={{ display: 'contents' }} />
      <Landscape
        sessions={sessions}
        notes={notes}
        nextSession={settings.nextSession}
        onOpenSession={s => setView({ kind: 'detail', id: s.id })}
        onOpenRoad={after => setView({ kind: 'road', after })}
        onNextSign={() => setView({ kind: 'next' })}
      />
      <Grain />

      <header className="top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="date">{headerDate(today)}</div>
          {line && (
            <button className="line" type="button" aria-label="首頁的話，點一下換一句" onClick={() => setLineIdx((lineIdx ?? lineOfTheDay(lines, today)) + 1)}>
              {line.text.split('|').map((t, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {t}
                </span>
              ))}
              {line.small && <small>{line.small}</small>}
            </button>
          )}
        </div>
        <button className="book" type="button" aria-label="全部紀錄" onClick={() => setView({ kind: 'book' })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" />
            <path d="M12 6v14" />
          </svg>
        </button>
      </header>

      <div className="bottom">
        <div className="hint">滑一滑，看看走過的路</div>
        <button className="pill" type="button" onClick={() => setView({ kind: 'ask' })}>記下今天</button>
      </div>
      </div>

      {sheet}
    </div>
  );
}

/** Paper grain: a small noise tile drawn once, not a live filter. */
function Grain() {
  const url = useMemo(() => {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const g = c.getContext('2d')!, img = g.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random();
        img.data[i] = img.data[i + 1] = 40;
        img.data[i + 2] = 60;
        img.data[i + 3] = v > 0.55 ? (v - 0.55) * 120 : 0;
      }
      g.putImageData(img, 0, 0);
      return c.toDataURL();
    } catch {
      return '';
    }
  }, []);
  return <div className="grain" aria-hidden="true" style={url ? { backgroundImage: `url(${url})` } : undefined} />;
}
