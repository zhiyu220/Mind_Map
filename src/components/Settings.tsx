import { useEffect, useRef, useState } from 'react';
import type { Settings as S } from '../types';
import { saveSettings } from '../db';
import { todayKey } from '../lib/dates';
import { hashPin } from '../lib/pin';
import { makeBackup, readBackup, restoreBackup, shareOrDownload } from '../lib/backup';
import { canRemote, clientId, disconnect, isConnected, startSpotifyLogin } from '../lib/spotify';
import { useToast } from './Toast';

export const HELPLINES = [
  { name: '安心專線', number: '1925', note: '24 小時，免付費' },
  { name: '生命線', number: '1995', note: '24 小時' },
  { name: '張老師專線', number: '1980', note: '' }
];

export function NextSessionField({ value, onDone }: { value?: string; onDone?: () => void }) {
  const [v, setV] = useState(value ?? '');
  return (
    <form
      className="addrow"
      onSubmit={async e => {
        e.preventDefault();
        await saveSettings({ nextSession: v || undefined });
        onDone?.();
      }}
    >
      <input id="next-session" className="field" type="date" min={todayKey()} value={v} onChange={e => setV(e.target.value)} />
      <button className="pill sm" type="submit">好</button>
    </form>
  );
}

export default function Settings({ settings, onClose }: { settings: S; onClose: () => void }) {
  const say = useToast();
  const [spotify, setSpotify] = useState<boolean | null>(null);
  const [remote, setRemote] = useState(false);
  const [hasClientId, setHasClientId] = useState(false);
  const [cid, setCid] = useState(settings.spotifyClientId ?? '');
  const [pinStep, setPinStep] = useState<'idle' | 'set' | 'again'>('idle');
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [restore, setRestore] = useState<Awaited<ReturnType<typeof readBackup>> | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;

  useEffect(() => {
    isConnected().then(setSpotify);
    canRemote().then(setRemote);
    clientId().then(id => setHasClientId(!!id));
  }, [settings.spotifyClientId]);

  const pinInput = async (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    if (digits.length < 4) return;
    if (pinStep === 'set') {
      setFirst(digits);
      setPin('');
      setPinStep('again');
    } else if (digits === first) {
      await saveSettings({ pinHash: await hashPin(digits) });
      setPin('');
      setPinStep('idle');
      say('設好了，下次打開要輸入密碼');
    } else {
      setPin('');
      setPinStep('set');
      say('兩次不一樣，再設一次');
    }
  };

  return (
    <section className="sheet" role="dialog" aria-label="設定">
      <div className="sheet-head">
        <button className="ghost" type="button" onClick={onClose}>返回</button>
      </div>
      <div className="sheet-body settings">
        <h2 className="q">設定</h2>

        <div className="group">
          <h3>下次諮商</h3>
          <p className="tiny">小路上的「下次」路牌和首頁的話會用到。去過之後會自動清掉。</p>
          <NextSessionField value={settings.nextSession} onDone={() => say('記住了')} />
        </div>

        <div className="group">
          <h3>Spotify</h3>
          {spotify ? (
            <>
              <p className="tiny">
                {remote
                  ? '已連結。記錄時可以用歌名搜尋；有 Premium 的話，紀錄裡可以按「用我的 Spotify 播完整首」，由手機上的 Spotify 播放。'
                  : '已連結，可以用歌名搜尋。重新連結一次，就能用你的 Spotify 播完整首（需要 Premium）。'}
              </p>
              <div className="row-buttons">
                {!remote && <button className="pill sm" type="button" onClick={() => disconnect().then(startSpotifyLogin)}>重新連結</button>}
                <button className="pill sm" type="button" onClick={() => disconnect().then(() => { setSpotify(false); setRemote(false); })}>取消連結</button>
              </div>
            </>
          ) : hasClientId ? (
            <>
              <p className="tiny">連結之後，記錄時就能用歌名搜尋；有 Premium 還能用你的 Spotify 播完整首。會跳到 Spotify 登入，再回到這裡。</p>
              <button className="pill sm" type="button" onClick={() => startSpotifyLogin()}>連結 Spotify</button>
            </>
          ) : (
            <>
              <p className="tiny">
                需要一組 Spotify 開發者的 Client ID（免費申請，給自己用）。沒有的話，記錄時也可以貼上歌曲連結。
              </p>
              <form className="addrow" onSubmit={async e => { e.preventDefault(); await saveSettings({ spotifyClientId: cid.trim() || undefined }); }}>
                <input id="spotify-cid" className="field" placeholder="Client ID" value={cid} onChange={e => setCid(e.target.value)} autoComplete="off" />
                <button className="pill sm" type="submit">儲存</button>
              </form>
              <p className="tiny">Redirect URI 請填：<code>{location.origin + location.pathname}</code></p>
            </>
          )}
        </div>

        <div className="group">
          <h3>密碼鎖</h3>
          {pinStep === 'idle' ? (
            settings.pinHash ? (
              <div className="row-buttons">
                <button className="pill sm" type="button" onClick={() => setPinStep('set')}>換一組</button>
                <button className="pill sm" type="button" onClick={() => saveSettings({ pinHash: undefined }).then(() => say('密碼鎖關掉了'))}>關掉</button>
              </div>
            ) : (
              <>
                <p className="tiny">打開 App 時要先輸入 4 位數字。</p>
                <button className="pill sm" type="button" onClick={() => setPinStep('set')}>設定密碼</button>
              </>
            )
          ) : (
            <>
              <p className="tiny">{pinStep === 'set' ? '輸入 4 位數字' : '再輸入一次'}</p>
              <input id="pin-new" className="field pin" inputMode="numeric" autoComplete="off" autoFocus type="password" value={pin} onChange={e => pinInput(e.target.value)} />
              <button className="linkish" type="button" onClick={() => { setPinStep('idle'); setPin(''); }}>算了</button>
            </>
          )}
          <p className="tiny">忘記密碼就打不開了（資料只在這支手機裡），記得也做備份。</p>
        </div>

        <div className="group">
          <h3>備份</h3>
          <p className="tiny">資料只存在這支手機。換手機、或怕被清掉時，存一份備份檔到「檔案」。</p>
          <div className="row-buttons">
            <button className="pill sm" type="button" onClick={async () => shareOrDownload(await makeBackup())}>匯出備份</button>
            <button className="pill sm" type="button" onClick={() => file.current?.click()}>從備份還原</button>
          </div>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                setRestore(await readBackup(f));
              } catch {
                say('這個檔案不是「我的天空」的備份');
              }
            }}
          />
          {restore && (
            <div className="confirm">
              用這份備份（{restore.sessions.length} 次諮商、{restore.notes.length} 則路上的事）取代手機上現在的紀錄？
              <button type="button" onClick={async () => { await restoreBackup(restore); setRestore(null); say('還原好了'); }}>取代</button>
              <button type="button" onClick={() => setRestore(null)}>不要</button>
            </div>
          )}
        </div>

        {!standalone && (
          <div className="group">
            <h3>加到主畫面</h3>
            <p className="tiny">用 Safari 打開這個網址，按下方的「分享」，選「加入主畫面」。之後從主畫面打開，就像一般的 App，沒有網路也能用。</p>
          </div>
        )}

        <div className="group">
          <h3>需要有人說說話的時候</h3>
          <ul className="helplines">
            {HELPLINES.map(h => (
              <li key={h.number}>
                <span>{h.name}{h.note && <small>{h.note}</small>}</span>
                <a href={`tel:${h.number}`}>{h.number}</a>
              </li>
            ))}
          </ul>
          <p className="tiny">如果有立即的危險，請打 119 或 110。</p>
        </div>
      </div>
    </section>
  );
}
