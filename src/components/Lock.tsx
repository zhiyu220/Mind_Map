import { useEffect, useState } from 'react';
import { afterMiss, hashPin, loadTries, saveTries } from '../lib/pin';
import { checkFaceId } from '../lib/faceid';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function Lock({ pinHash, faceId, onUnlock }: { pinHash: string; faceId?: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [tries, setTries] = useState(loadTries);
  const [now, setNow] = useState(Date.now);
  const waitFor = Math.max(0, Math.ceil((tries.until - now) / 1000));

  const face = async () => {
    if (faceId && (await checkFaceId(faceId))) {
      saveTries(null);
      onUnlock();
    }
  };

  // tick while you have to wait
  useEffect(() => {
    if (!waitFor) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitFor > 0]);

  const press = async (k: string) => {
    if (!k || waitFor || pin.length === 4) return; // four digits in: checking them
    if (k === '⌫') return setPin(pin.slice(0, -1));
    const next = pin + k;
    setPin(next);
    setWrong(false);
    if (next.length === 4) {
      await new Promise(r => setTimeout(r, 200)); // let the fourth dot show before moving on
      if ((await hashPin(next)) === pinHash) {
        saveTries(null);
        onUnlock();
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
        {[0, 1, 2, 3].map(i => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="keypad" aria-disabled={!!waitFor}>
        {KEYS.map((k, i) => (
          <button key={i} type="button" disabled={!k || !!waitFor} aria-label={k === '⌫' ? '刪除' : k || undefined} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
      {faceId && (
        <button className="pill sm" type="button" onClick={face}>用 Face ID 解鎖</button>
      )}
    </section>
  );
}
