import { useState } from 'react';
import type { Practice } from '../types';
import { todayKey } from '../lib/dates';
import { addPractice, archivePractice, deletePractice, renamePractice, tryPractice } from '../lib/store';
import { useToast } from './Toast';

/** A little sprout for each day you tried it. Not a score: there's nothing to finish. */
export function Sprouts({ tries }: { tries: string[] }) {
  if (!tries.length) return null;
  const shown = tries.slice(-14);
  return (
    <span className="sprouts" aria-label={`試過 ${tries.length} 次`}>
      {shown.map((d, i) => (
        <svg key={d + i} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 15V8" stroke="var(--tree)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 9C8 5 5 3 2 4c0 3 3 5 6 5zM8 8c0-3 2-5 6-5 0 3-2 5-6 5z" fill="var(--tree-2)" stroke="var(--ink)" strokeWidth="1" />
        </svg>
      ))}
      {tries.length > shown.length && <small>…</small>}
    </span>
  );
}

/** 想練習的事: things to try between sessions; tap 試過了 on a day you did. */
export default function Practices({ practices }: { practices: Practice[] }) {
  const say = useToast();
  const today = todayKey();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showAway, setShowAway] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const active = practices.filter(p => !p.archived).sort((a, b) => a.createdAt - b.createdAt);
  const away = practices.filter(p => p.archived);

  const add = async () => {
    const t = text.trim();
    if (!t) return setAdding(false);
    await addPractice(t);
    setText('');
    setAdding(false);
  };

  return (
    <div className="practices">
      <div className="label">想練習的事</div>
      {!active.length && !adding && <p className="tiny">諮商師給的小功課，或自己想試試的事。做到的那天點一下「試過了」就好。</p>}
      {active.map(p =>
        editing === p.id ? (
          <EditPractice key={p.id} p={p} onDone={() => setEditing(null)} />
        ) : (
          <div key={p.id} className="practice">
            <div className="practice-txt">
              <span>{p.text}</span>
              <Sprouts tries={p.tries} />
              <div className="row-links">
                <button className="linkish small" type="button" onClick={() => setEditing(p.id)}>修改</button>
                <button className="linkish small" type="button" onClick={() => (archivePractice(p.id, true), say('收起來了，想再練的時候在下面找得到'))}>收起來</button>
              </div>
            </div>
            <button className="tried" type="button" aria-pressed={p.tries.includes(today)} onClick={() => tryPractice(p, today)}>
              {p.tries.includes(today) ? '今天試過了' : '試過了'}
            </button>
          </div>
        )
      )}
      {adding ? (
        <div className="addrow">
          <input className="field" autoFocus value={text} placeholder="例如：睡前寫三件小事" onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="pill sm" type="button" onClick={add}>好</button>
        </div>
      ) : (
        <button className="linkish" type="button" onClick={() => setAdding(true)}>＋ 加一件想練習的事</button>
      )}
      {away.length > 0 && (
        <>
          <button className="linkish small" type="button" onClick={() => setShowAway(!showAway)}>
            {showAway ? '不看收起來的' : `收起來的練習（${away.length}）`}
          </button>
          {showAway &&
            away.map(p => (
              <div key={p.id} className="practice away">
                <div className="practice-txt">
                  <span>{p.text}</span>
                  <Sprouts tries={p.tries} />
                  {confirm === p.id ? (
                    <div className="confirm">
                      刪掉這件練習？
                      <button type="button" onClick={() => deletePractice(p.id)}>刪掉</button>
                      <button type="button" onClick={() => setConfirm(null)}>不要</button>
                    </div>
                  ) : (
                    <div className="row-links">
                      <button className="linkish small" type="button" onClick={() => archivePractice(p.id, false)}>拿出來</button>
                      <button className="linkish small" type="button" onClick={() => setConfirm(p.id)}>刪除</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}

function EditPractice({ p, onDone }: { p: Practice; onDone: () => void }) {
  const [text, setText] = useState(p.text);
  const save = async () => {
    if (text.trim()) await renamePractice(p.id, text.trim());
    onDone();
  };
  return (
    <div className="addrow">
      <input className="field" autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      <button className="pill sm" type="button" onClick={save}>好</button>
    </div>
  );
}
