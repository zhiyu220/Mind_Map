import { useState } from 'react';
import type { Session } from '../types';
import { WEATHER_NAME } from '../types';
import { long, short } from '../lib/dates';
import { addFound, deleteFound } from '../lib/store';

/**
 * The lamp by the walker: for the moment something suddenly makes sense, days after a session.
 * Write it down, then say which session it grew out of (the latest, unless you pick another).
 */
export function LampSheet({ sessions, onSaved, onClose }: { sessions: Session[]; onSaved: () => void; onClose: () => void }) {
  const recent = sessions.slice(-5).reverse();
  const [text, setText] = useState('');
  const [step, setStep] = useState<'write' | 'link'>('write');
  const [from, setFrom] = useState(recent[0]?.id ?? '');

  const save = async () => {
    if (!text.trim() || !from) return;
    await addFound(from, text.trim());
    onSaved();
  };

  return (
    <section className="sheet" role="dialog" aria-label="想通了">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={step === 'write' ? onClose : () => setStep('write')}>{step === 'write' ? '關閉' : '上一步'}</button>
      </div>
      <div className="sheet-body">
        {step === 'write' ? (
          <>
            <h2 className="q">想通了什麼？</h2>
            <textarea id="lamp-text" className="field tall" autoFocus placeholder="後來我發現……" value={text} onChange={e => setText(e.target.value)} />
          </>
        ) : (
          <>
            <h2 className="q">是從哪一次延伸出來的？</h2>
            <div className="lamp-from" role="radiogroup" aria-label="哪一次諮商">
              {recent.map(s => (
                <button key={s.id} className="big" type="button" role="radio" aria-checked={from === s.id} aria-pressed={from === s.id} onClick={() => setFrom(s.id)}>
                  <span>
                    {long(s.date)}
                    <small>{s.quote.trim() ? `「${s.quote.trim()}」` : WEATHER_NAME[s.weather]}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="sheet-foot">
        <span />
        {step === 'write' ? (
          <button className="pill" type="button" disabled={!text.trim()} onClick={() => setStep('link')}>下一步</button>
        ) : (
          <button className="pill" type="button" onClick={save}>放進罐子</button>
        )}
      </div>
    </section>
  );
}

/**
 * The jar on the windowsill of the house at the start: every 後來我發現, one light at a time.
 * No count, no order to finish; just the next one, and the one before.
 */
export function JarSheet({ sessions, onClose }: { sessions: Session[]; onClose: () => void }) {
  const lights = sessions
    .flatMap(s => (s.found ?? []).map(f => ({ f, s })))
    .sort((a, b) => b.f.date.localeCompare(a.f.date) || b.f.createdAt - a.f.createdAt);
  const [i, setI] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const at = lights.length ? lights[Math.min(i, lights.length - 1)] : null;

  return (
    <section className="sheet" role="dialog" aria-label="罐子">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>回到小路</button>
      </div>
      <div className="sheet-body jar">
        <h2 className="q">罐子裡的光</h2>
        {at ? (
          <>
            <div className="light-card">
              <span>{at.f.text}</span>
              <small>{long(at.f.date)} · 從 {short(at.s.date)} 那次延伸出來的</small>
              {at.s.quote.trim() && <small>那次記下的：「{at.s.quote.trim()}」</small>}
            </div>
            <div className="row-buttons even">
              {lights.length > 1 && (
                <>
                  <button className="pill sm" type="button" onClick={() => (setI((i - 1 + lights.length) % lights.length), setConfirm(false))}>上一顆</button>
                  <button className="pill sm" type="button" onClick={() => (setI((i + 1) % lights.length), setConfirm(false))}>下一顆</button>
                </>
              )}
            </div>
            {confirm ? (
              <div className="confirm">
                讓這一顆光離開罐子？
                <button type="button" onClick={async () => { await deleteFound(at.s.id, at.f.id); setConfirm(false); setI(0); }}>好</button>
                <button type="button" onClick={() => setConfirm(false)}>不要</button>
              </div>
            ) : (
              <button className="linkish small" type="button" onClick={() => setConfirm(true)}>拿出這一顆</button>
            )}
          </>
        ) : (
          <p className="sub">罐子還是空的。突然想通什麼的時候，點小人旁邊的路燈寫下來，就會收進這裡。</p>
        )}
      </div>
    </section>
  );
}
