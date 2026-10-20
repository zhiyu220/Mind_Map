import { useState } from 'react';
import { hashPin } from '../lib/pin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function Lock({ pinHash, onUnlock }: { pinHash: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  const press = async (k: string) => {
    if (!k) return;
    if (k === '⌫') return setPin(pin.slice(0, -1));
    const next = (pin + k).slice(0, 4);
    setPin(next);
    setWrong(false);
    if (next.length === 4) {
      if ((await hashPin(next)) === pinHash) onUnlock();
      else {
        setWrong(true);
        setTimeout(() => setPin(''), 300);
      }
    }
  };

  return (
    <section className="lock" aria-label="輸入密碼">
      <h2>{wrong ? '再試一次' : '輸入密碼'}</h2>
      <div className="pin-dots" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="keypad">
        {KEYS.map((k, i) => (
          <button key={i} type="button" disabled={!k} aria-label={k === '⌫' ? '刪除' : k || undefined} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
    </section>
  );
}
