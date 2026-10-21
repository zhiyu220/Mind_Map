import { useState } from 'react';
import type { Person, Settings } from '../types';
import { saveSettings } from '../db';
import { HELPLINES } from '../lib/helplines';

/**
 * 想說話的時候: the people of your own, places or things that help, and the helplines. It points
 * outward, to real people; it never asks whether you reached anyone, and keeps no record of it.
 */
export default function Talk({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const people = settings.people ?? [];
  const [editing, setEditing] = useState(false);

  return (
    <section className="sheet" role="dialog" aria-label="想說話的時候">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>關閉</button>
        <button className="ghost" type="button" onClick={() => setEditing(!editing)}>{editing ? '好了' : '整理'}</button>
      </div>
      <div className="sheet-body talk">
        <h2 className="q">想說話的時候</h2>
        {editing ? (
          <TalkEditor settings={settings} onDone={() => setEditing(false)} />
        ) : (
          <>
            {people.length > 0 && (
              <div className="prep-box">
                <div className="label">我的人</div>
                <ul className="helplines">
                  {people.map((p, i) => (
                    <li key={i}>
                      <span>{p.name}</span>
                      <a href={`${p.via === 'sms' ? 'sms' : 'tel'}:${p.phone}`}>{p.via === 'sms' ? '傳訊息' : '打電話'}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {settings.places?.trim() && (
              <div className="prep-box">
                <div className="label">可以去的地方、可以做的事</div>
                <p className="notes">{settings.places}</p>
              </div>
            )}
            <div className="prep-box">
              <div className="label">專線 · 只是想說說話也可以打</div>
              <Helplines />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function Helplines() {
  return (
    <>
      <ul className="helplines">
        {HELPLINES.map(h => (
          <li key={h.number}>
            <span>{h.name}{h.note && <small>{h.note}</small>}</span>
            <a href={`tel:${h.number}`}>{h.number}</a>
          </li>
        ))}
      </ul>
      <p className="tiny">如果有立即的危險，請打 119 或 110。</p>
    </>
  );
}

function TalkEditor({ settings, onDone }: { settings: Settings; onDone: () => void }) {
  const [people, setPeople] = useState<Person[]>(settings.people?.length ? settings.people : [{ name: '', phone: '', via: 'call' }]);
  const [places, setPlaces] = useState(settings.places ?? '');
  const set = (i: number, patch: Partial<Person>) => setPeople(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const save = async () => {
    const kept = people.map(p => ({ ...p, name: p.name.trim(), phone: p.phone.trim() })).filter(p => p.name && p.phone);
    await saveSettings({ people: kept.length ? kept : undefined, places: places.trim() || undefined });
    onDone();
  };
  return (
    <>
      <p className="sub">只存在這支手機和你的加密備份裡。沒填的不會出現。</p>
      <div className="label">我的人（最多三個）</div>
      {people.map((p, i) => (
        <div key={i} className="person-row">
          <input className="field" placeholder="名字" value={p.name} onChange={e => set(i, { name: e.target.value })} />
          <input className="field" placeholder="電話" inputMode="tel" value={p.phone} onChange={e => set(i, { phone: e.target.value })} />
          <div className="chips small">
            <button className="chip" type="button" aria-pressed={p.via === 'call'} onClick={() => set(i, { via: 'call' })}>打電話</button>
            <button className="chip" type="button" aria-pressed={p.via === 'sms'} onClick={() => set(i, { via: 'sms' })}>傳訊息</button>
            <button className="linkish small" type="button" onClick={() => setPeople(ps => ps.filter((_, j) => j !== i))}>拿掉</button>
          </div>
        </div>
      ))}
      {people.length < 3 && (
        <button className="linkish small" type="button" onClick={() => setPeople([...people, { name: '', phone: '', via: 'call' }])}>再加一個人</button>
      )}
      <label className="raw">
        <span>可以去的地方、可以做的事</span>
        <textarea className="field" placeholder="例如：去河邊騎車" value={places} onChange={e => setPlaces(e.target.value)} />
      </label>
      <button className="pill" type="button" onClick={save}>存起來</button>
    </>
  );
}
