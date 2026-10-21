import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** A short line at the bottom. With `undo`, it stays a little longer and offers 收回. */
type Say = (msg: string, undo?: () => void) => void;

const Ctx = createContext<Say>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const timer = useRef<number>(undefined);
  const say = useCallback<Say>((m, u) => {
    setMsg(m);
    setUndo(() => u ?? null);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => (setShow(false), setUndo(null)), u ? 4500 : 2400);
  }, []);
  const takeBack = () => {
    undo?.();
    clearTimeout(timer.current);
    setShow(false);
    setUndo(null);
  };
  return (
    <Ctx.Provider value={say}>
      {children}
      <div className={`toast${show ? ' show' : ''}${undo ? ' with-undo' : ''}`} role="status">
        {msg}
        {undo && <button type="button" onClick={takeBack}>收回</button>}
      </div>
    </Ctx.Provider>
  );
}
