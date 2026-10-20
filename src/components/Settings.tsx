import { useEffect, useRef, useState } from 'react';
import type { Settings as S } from '../types';
import { saveSettings } from '../db';
import { todayKey } from '../lib/dates';
import { hashPin } from '../lib/pin';
import { canUseFaceId, checkFaceId, setUpFaceId } from '../lib/faceid';
import { makeBackup, openBackup, readBackup, restoreBackup, shareOrDownload, type Backup } from '../lib/backup';
import type { Sealed } from '../lib/crypto';
import { clientId, disconnect, isConnected, needsReconnect, playlistInfo, playlistUrl, startSpotifyLogin } from '../lib/spotify';
import { useToast } from './Toast';

export const HELPLINES = [
  { name: '安心專線', number: '1925', note: '24 小時，免付費' },
  { name: '生命線', number: '1995', note: '24 小時' },
  { name: '張老師專線', number: '1980', note: '' }
];

const SKY_MODES: [NonNullable<S['sky']>, string][] = [['time', '晚上變成夜空'], ['phone', '跟著手機的深色模式'], ['day', '一直是白天']];
const SEASONS: [NonNullable<S['season']>, string][] = [['auto', '跟著日子'], ['spring', '春天'], ['summer', '夏天'], ['autumn', '秋天'], ['winter', '冬天']];

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
  const [reconnect, setReconnect] = useState(false);
  const [playlist, setPlaylist] = useState<string | null>(null);
  const [hasClientId, setHasClientId] = useState(false);
  const [cid, setCid] = useState(settings.spotifyClientId ?? '');
  const [pinStep, setPinStep] = useState<'idle' | 'set' | 'again'>('idle');
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [faceOk, setFaceOk] = useState(false);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;

  useEffect(() => {
    isConnected().then(setSpotify);
    needsReconnect().then(setReconnect);
    playlistInfo().then(p => setPlaylist(p?.id ?? null));
    clientId().then(id => setHasClientId(!!id));
  }, [settings.spotifyClientId]);
  useEffect(() => {
    canUseFaceId().then(setFaceOk);
  }, []);

  const turnOnFace = async () => {
    const id = await setUpFaceId();
    // make sure it really answers before relying on it
    if (id && (await checkFaceId(id))) {
      await saveSettings({ faceId: id });
      say('好了，下次打開用 Face ID 就好');
    } else say('沒有設好，可以再試一次');
  };

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
          <h3>天空</h3>
          <div className="chips small" role="radiogroup" aria-label="天空">
            {SKY_MODES.map(([k, name]) => (
              <button key={k} className="chip" type="button" role="radio" aria-checked={(settings.sky ?? 'time') === k} aria-pressed={(settings.sky ?? 'time') === k}
                onClick={() => saveSettings({ sky: k })}>{name}</button>
            ))}
          </div>
        </div>

        <div className="group">
          <h3>季節</h3>
          <div className="chips small" role="radiogroup" aria-label="季節">
            {SEASONS.map(([k, name]) => (
              <button key={k} className="chip" type="button" role="radio" aria-checked={(settings.season ?? 'auto') === k} aria-pressed={(settings.season ?? 'auto') === k}
                onClick={() => saveSettings({ season: k })}>{name}</button>
            ))}
          </div>
          <p className="tiny">春天落櫻花，夏天有向日葵、晚上有螢火蟲，秋天掉葉子，冬天下雪、晚上有極光。</p>
        </div>
        <div className="group">
          <h3>Spotify</h3>
          {spotify ? (
            <>
              <p className="tiny">
                {reconnect
                  ? '已連結，可以用歌名搜尋。重新連結一次，就能用你的 Spotify 播完整首（需要 Premium）、選剛剛聽的歌，並自動整理「Mind Map」歌單。'
                  : '已連結。記錄時可以用歌名搜尋，或直接選剛剛聽的歌；有 Premium 的話，紀錄裡可以按「用我的 Spotify 播完整首」。'}
              </p>
              <div className="row-buttons">
                {reconnect && <button className="pill sm" type="button" onClick={() => disconnect().then(startSpotifyLogin)}>重新連結</button>}
                <button className="pill sm" type="button" onClick={() => disconnect().then(() => { setSpotify(false); setReconnect(false); })}>取消連結</button>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={settings.spotifyPlaylist !== false} onChange={e => saveSettings({ spotifyPlaylist: e.target.checked })} />
                <span>
                  自動整理成「Mind Map」歌單
                  <small>每次紀錄附上的歌，照諮商的日期排進你 Spotify 裡的一個私人歌單。</small>
                </span>
              </label>
              <div className="row-buttons">
                {playlist && settings.spotifyPlaylist !== false && <a className="linkish" href={playlistUrl(playlist)} target="_blank" rel="noreferrer">在 Spotify 打開歌單</a>}
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
                <button className="pill sm" type="button" onClick={() => saveSettings({ pinHash: undefined, faceId: undefined }).then(() => say('密碼鎖關掉了'))}>關掉</button>
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
          {settings.pinHash && pinStep === 'idle' && faceOk && (
            settings.faceId ? (
              <p className="tiny">
                Face ID 已開啟。認不出來的時候，還是可以輸入密碼。{' '}
                <button className="linkish small" type="button" style={{ display: 'inline' }} onClick={() => saveSettings({ faceId: undefined }).then(() => say('Face ID 關掉了'))}>不用 Face ID</button>
              </p>
            ) : (
              <button className="pill sm" type="button" onClick={turnOnFace}>改用 Face ID 解鎖</button>
            )
          )}
          <p className="tiny">忘記密碼就打不開了（資料只在這支手機裡），記得也做備份。</p>
        </div>

        <BackupGroup />

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

/** 備份: always locked with a password you choose; old unlocked backups still open. */
function BackupGroup() {
  const say = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [making, setMaking] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<Sealed | null>(null);
  const [openPw, setOpenPw] = useState('');
  const [restore, setRestore] = useState<Backup | null>(null);

  const doExport = async () => {
    if (pw.length < 6) return say('密碼至少 6 個字');
    if (pw !== pw2) return say('兩次輸入的密碼不一樣');
    setBusy(true);
    try {
      await shareOrDownload(await makeBackup(pw));
      setMaking(false);
      setPw('');
      setPw2('');
    } finally {
      setBusy(false);
    }
  };

  const doOpen = async () => {
    if (!locked) return;
    setBusy(true);
    try {
      setRestore(await openBackup(locked, openPw));
      setLocked(null);
      setOpenPw('');
    } catch {
      say('密碼不對，打不開這份備份');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group">
      <h3>備份</h3>
      <p className="tiny">資料只存在這支手機。換手機、或怕被清掉時，存一份備份檔到「檔案」。備份檔會用你設的密碼鎖起來，別人拿到檔案也看不到內容。</p>
      {making ? (
        <div className="backup-form">
          <input id="backup-pw" className="field" type="password" autoComplete="new-password" placeholder="備份密碼（至少 6 個字）" value={pw} onChange={e => setPw(e.target.value)} />
          <input id="backup-pw2" className="field" type="password" autoComplete="new-password" placeholder="再輸入一次" value={pw2} onChange={e => setPw2(e.target.value)} />
          <p className="tiny">忘記這組密碼，這份備份就打不開了。它跟開 App 的 4 位數密碼是分開的。</p>
          <div className="row-buttons">
            <button className="pill sm" type="button" disabled={busy} onClick={doExport}>{busy ? '加密中…' : '匯出'}</button>
            <button className="ghost" type="button" onClick={() => (setMaking(false), setPw(''), setPw2(''))}>算了</button>
          </div>
        </div>
      ) : (
        <div className="row-buttons">
          <button className="pill sm" type="button" onClick={() => setMaking(true)}>匯出備份</button>
          <button className="pill sm" type="button" onClick={() => file.current?.click()}>從備份還原</button>
        </div>
      )}
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
            const b = await readBackup(f);
            if (b.locked) setLocked(b.sealed);
            else setRestore(b.data);
          } catch {
            say('這個檔案不是「Mind Map」的備份');
          }
        }}
      />
      {locked && (
        <div className="backup-form">
          <input id="backup-open" className="field" type="password" autoComplete="current-password" placeholder="這份備份的密碼" value={openPw} onChange={e => setOpenPw(e.target.value)} />
          <div className="row-buttons">
            <button className="pill sm" type="button" disabled={busy} onClick={doOpen}>{busy ? '解開中…' : '打開'}</button>
            <button className="ghost" type="button" onClick={() => (setLocked(null), setOpenPw(''))}>算了</button>
          </div>
        </div>
      )}
      {restore && (
        <div className="confirm">
          用這份備份（{restore.sessions.length} 次諮商、{restore.notes.length} 則路上的事）取代手機上現在的紀錄？
          <button type="button" onClick={async () => { await restoreBackup(restore); setRestore(null); say('還原好了'); }}>取代</button>
          <button type="button" onClick={() => setRestore(null)}>不要</button>
        </div>
      )}
    </div>
  );
}
