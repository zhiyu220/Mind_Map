import { useEffect, useState } from 'react';
import { afterMiss, loadTries, saveTries } from '../lib/pin';
import { openWithFace, openWithPin, type Opened } from '../lib/lockbox';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** digits: how long the PIN is; face: Face ID can open it. */
export default function Lock({ digits, face, onUnlock }: { digits: number; face: boolean; onUnlock: (how: Opened) => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [tries, setTries] = useState(loadTries);
  const [now, setNow] = useState(Date.now);
  const waitFor = Math.max(0, Math.ceil((tries.until - now) / 1000));

  const byFace = async () => {
    if (await openWithFace()) {
      saveTries(null);
      onUnlock('ok');
    }
  };

  // tick while you have to wait
  useEffect(() => {
    if (!waitFor) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitFor > 0]);

  const press = async (k: string) => {
    if (!k || waitFor || pin.length === digits) return; // all digits in: checking them
    if (k === '⌫') return setPin(pin.slice(0, -1));
    const next = pin + k;
    setPin(next);
    setWrong(false);
    if (next.length === digits) {
      await new Promise(r => setTimeout(r, 200)); // let the last dot show before moving on
      const how = await openWithPin(next);
      if (how !== 'wrong') {
        saveTries(null);
        onUnlock(how);
      } else {
        const t = afterMiss(tries, Date.now());
        saveTries(t);
        setTries(t);
        setNow(Date.now());
        setWrong(true);
        setTimeout(() => setPin(''), 300);
      }
    }
  };

  const wait = waitFor >= 60 ? `${Math.ceil(waitFor / 60)} 分鐘` : `${waitFor} 秒`;
  return (
    <section className="lock" aria-label="輸入密碼">
      <h2>{waitFor ? `錯太多次了，${wait}後再試` : wrong ? '再試一次' : '輸入密碼'}</h2>
      <div className="pin-dots" aria-hidden="true">
        {Array.from({ length: digits }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="keypad" aria-disabled={!!waitFor}>
        {KEYS.map((k, i) => (
          <button key={i} type="button" disabled={!k || !!waitFor} aria-label={k === '⌫' ? '刪除' : k || undefined} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
      {face && (
        <button className="pill sm" type="button" onClick={byFace}>用 Face ID 解鎖</button>
      )}
    </section>
  );
}
