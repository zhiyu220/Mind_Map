import { saveSettings } from '../db';
import type { Settings } from '../types';
import { DEFAULT_TIME_LOCK, shown } from '../lib/timelock';
import { useToast } from './Toast';

/** 時間鎖 in 設定 (and on its own, from the closed screen). */
export function TimeLockGroup({ settings }: { settings: Settings }) {
  const say = useToast();
  const lock = settings.timeLock ?? DEFAULT_TIME_LOCK;
  const set = (patch: Partial<typeof lock>) => saveSettings({ timeLock: { ...lock, ...patch } });
  return (
    <div className="group">
      <h3>時間鎖</h3>
      <label className="toggle">
        <input type="checkbox" checked={lock.on} onChange={e => {
          const on = e.target.checked;
          set({ on }).then(() => say(on ? '好了，下次打開開始算' : '時間鎖關掉了'));
        }} />
        <span>
          只在這段時間打開
          <small>其他時間打不開，諮商當天整天都可以。正在寫的會讓你寫完，下次打開才鎖。</small>
        </span>
      </label>
      <div className="time-range">
        <input id="time-from" className="field" type="time" aria-label="從" value={lock.from} onChange={e => e.target.value && set({ from: e.target.value })} />
        <span>到</span>
        <input id="time-to" className="field" type="time" aria-label="到" value={lock.to} onChange={e => e.target.value && set({ to: e.target.value })} />
      </div>
      {lock.to === '00:00' && <p className="tiny">00:00 是半夜 12 點（{shown(lock.to, true)}）。</p>}
    </div>
  );
}

/** The closed screen: no count, no countdown, just when it opens again. */
export function TimeClosed({ settings, onAdjust }: { settings: Settings; onAdjust: () => void }) {
  return (
    <section className="lock time-closed" aria-label="時間鎖">
      <h2>現在先休息</h2>
      <p>{settings.timeLock?.from ?? DEFAULT_TIME_LOCK.from} 再來</p>
      <button className="linkish small" type="button" onClick={onAdjust}>調整時間鎖</button>
    </section>
  );
}

/** From the closed screen: only the time lock can be changed here. */
export function TimeLockSheet({ settings, onDone }: { settings: Settings; onDone: () => void }) {
  return (
    <section className="sheet" role="dialog" aria-label="調整時間鎖">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onDone}>好了</button>
      </div>
      <div className="sheet-body settings">
        <h2 className="q">調整時間鎖</h2>
        <TimeLockGroup settings={settings} />
      </div>
    </section>
  );
}
