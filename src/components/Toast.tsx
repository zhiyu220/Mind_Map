import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<number>(undefined);
  const say = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 2400);
  }, []);
  return (
    <Ctx.Provider value={say}>
      {children}
      <div className={`toast${show ? ' show' : ''}`} role="status">{msg}</div>
    </Ctx.Provider>
  );
}
