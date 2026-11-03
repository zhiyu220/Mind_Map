import { useEffect, useRef, useState } from 'react';
import type { Settings as S } from '../types';
import { saveSettings } from '../db';
import { addDays, long, short, toKey, todayKey } from '../lib/dates';
import Helplines from './Helplines';
import { useLiveQuery } from 'dexie-react-hooks';
import { canUseFaceId } from '../lib/faceid';
import { addFace, changePin, getLockbox, removeFace, removePin, setPin as lockWith } from '../lib/lockbox';
import { BACKUP_NAME, BadBackup, beforeRestoreAt, compareBackup, lastExport, makeBackup, openBackup, readBackup, recordExport, restoreBackup, shareOrDownload, undoRestore, type Backup } from '../lib/backup';
import type { Sealed } from '../lib/crypto';
import { clientId, disconnect, isConnected, needsReconnect, playlistInfo, playlistUrl, startSpotifyLogin } from '../lib/spotify';
import { useToast } from './Toast';


const SKY_MODES: [NonNullable<S['sky']>, string][] = [['time', '晚上變成夜空'], ['phone', '跟著手機的深色模式'], ['day', '一直是白天']];
const WALKERS: [NonNullable<S['walker']>, string][] = [['girl', '女生'], ['boy', '男生']];
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
      <div className="quick-dates">
        <button className="chip" type="button" onClick={() => setV(addDays(todayKey(), 7))}>一週後</button>
        <button className="chip" type="button" onClick={() => setV(addDays(todayKey(), 14))}>兩週後</button>
      </div>
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
  const [digits, setDigits] = useState(6);
  const [busy, setBusy] = useState(false);
  const box = useLiveQuery(getLockbox, []);
  // a PIN from before 2.1, not yet entered since: the records get sealed the next time it is
  const oldPin = !box && !!settings.pinHash;
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
    // asks for Face ID twice: once to make the key, once to get its secret
    const r = await addFace();
    if (r === 'ok') say('好了，下次打開用 Face ID 就好');
    else if (r === 'unsupported') say('這支手機的 Face ID 還不能解開加密的紀錄（要 iOS 18 以上），先用密碼');
    else say('沒有設好，可以再試一次');
  };

  const pinInput = async (v: string) => {
    if (pin.length === digits || busy) return; // all digits in: moving on
    const typed = v.replace(/\D/g, '').slice(0, digits);
    setPin(typed);
    if (typed.length < digits) return;
    await new Promise(r => setTimeout(r, 200)); // let the last dot show before moving on
    if (pinStep === 'set') {
      setFirst(typed);
      setPin('');
      setPinStep('again');
    } else if (typed === first) {
      setBusy(true);
      try {
        if (box) await changePin(typed);
        else await lockWith(typed);
        say(box ? '換好了' : '設好了，紀錄都加密了。下次打開要輸入密碼');
      } catch {
        say('沒有設好，可以再試一次');
      }
      setBusy(false);
      setPin('');
      setPinStep('idle');
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
          <label className="toggle">
            <input type="checkbox" checked={!!settings.resting} onChange={e => saveSettings({ resting: e.target.checked || undefined })} />
            <span>
              先休息一陣子
              <small>暫停諮商的時候打開。首頁不數天數、不倒數，下次記下諮商時會自動關掉。</small>
            </span>
          </label>
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
          <h3>小路上的人</h3>
          <div className="chips small" role="radiogroup" aria-label="小路上的人">
            {WALKERS.map(([k, name]) => (
              <button key={k} className="chip" type="button" role="radio" aria-checked={(settings.walker ?? 'girl') === k} aria-pressed={(settings.walker ?? 'girl') === k}
                onClick={() => saveSettings({ walker: k })}>{name}</button>
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
                <input type="checkbox" checked={settings.spotifyPlaylist === true} onChange={e => saveSettings({ spotifyPlaylist: e.target.checked })} />
                <span>
                  自動整理成「Mind Map」歌單
                  <small>每次紀錄附上的歌，照日期排進你 Spotify 裡的一個私人歌單。打開後，Spotify 會看得到這份歌單和歌的順序。</small>
                </span>
              </label>
              <div className="row-buttons">
                {playlist && settings.spotifyPlaylist === true && <a className="linkish" href={playlistUrl(playlist)} target="_blank" rel="noreferrer">在 Spotify 打開歌單</a>}
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
          {busy ? (
            <p className="tiny">正在把紀錄加密……</p>
          ) : pinStep === 'idle' ? (
            box || oldPin ? (
              <>
                {box && <p className="tiny">手機裡的紀錄是加密存放的，輸入密碼才解得開。</p>}
                {oldPin && <p className="tiny">下次用密碼打開時，手機裡的紀錄會一起加密。</p>}
                {box?.digits === 4 && <p className="tiny">現在是 4 位數，換成 6 位數會安全很多。</p>}
                <div className="row-buttons">
                  <button className="pill sm" type="button" onClick={() => { setDigits(6); setPinStep('set'); }}>換一組</button>
                  <button className="pill sm" type="button"
                    onClick={() => (box ? removePin() : saveSettings({ pinHash: undefined, faceId: undefined })).then(() => say('密碼鎖關掉了，紀錄不再加密'), () => say('沒有關掉，可以再試一次'))}>關掉</button>
                </div>
              </>
            ) : (
              <>
                <p className="tiny">打開 App 時要先輸入密碼，手機裡的紀錄也會加密存放。</p>
                <button className="pill sm" type="button" onClick={() => { setDigits(6); setPinStep('set'); }}>設定密碼</button>
              </>
            )
          ) : (
            <>
              <p className="tiny">{pinStep === 'set' ? `輸入 ${digits} 位數字` : '再輸入一次'}</p>
              <input id="pin-new" className="field pin" inputMode="numeric" autoComplete="off" autoFocus type="password" value={pin} onChange={e => pinInput(e.target.value)} />
              {pinStep === 'set' && (
                <button className="linkish" type="button" onClick={() => { setDigits(digits === 6 ? 4 : 6); setPin(''); }}>
                  {digits === 6 ? '用 4 位數就好' : '改用 6 位數（比較安全）'}
                </button>
              )}
              <button className="linkish" type="button" onClick={() => { setPinStep('idle'); setPin(''); }}>算了</button>
            </>
          )}
          {box && pinStep === 'idle' && !busy && faceOk && (
            box.face ? (
              <p className="tiny">
                Face ID 已開啟。認不出來的時候，還是可以輸入密碼。{' '}
                <button className="linkish small" type="button" style={{ display: 'inline' }} onClick={() => removeFace().then(() => say('Face ID 關掉了'))}>不用 Face ID</button>
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
          <Helplines />
        </div>

        <p className="tiny version">Mind Map {__APP_VERSION__}{__APP_COMMIT__ && ` · ${__APP_COMMIT__}`}</p>
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
  const [restore, setRestore] = useState<{ data: Backup; diff: Awaited<ReturnType<typeof compareBackup>> } | null>(null);
  const [last, setLast] = useState<Awaited<ReturnType<typeof lastExport>>>(null);
  const [kept, setKept] = useState<boolean | null>(null);
  const [before, setBefore] = useState<number | null>(null);

  // facts only: when you last exported, and whether the phone promised to keep the data
  const refresh = () => {
    lastExport().then(setLast);
    beforeRestoreAt().then(setBefore);
    navigator.storage?.persisted?.().then(setKept).catch(() => setKept(null));
  };
  useEffect(refresh, []);

  const doExport = async () => {
    if (pw.length < 6) return say('密碼至少 6 個字');
    if (pw !== pw2) return say('兩次輸入的密碼不一樣');
    setBusy(true);
    try {
      navigator.storage?.persist?.().catch(() => {});
      if (await shareOrDownload(await makeBackup(pw))) {
        await recordExport();
        setMaking(false);
        setPw('');
        setPw2('');
        refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const ask = async (data: Backup) => setRestore({ data, diff: await compareBackup(data) });

  const doOpen = async () => {
    if (!locked) return;
    setBusy(true);
    try {
      await ask(await openBackup(locked, openPw));
      setLocked(null);
      setOpenPw('');
    } catch (e) {
      say(e instanceof BadBackup ? `這份備份有地方壞了（${e.message}），沒有還原` : '密碼不對，打不開這份備份');
    } finally {
      setBusy(false);
    }
  };

  const back = async () => {
    await undoRestore();
    refresh();
    say('回到還原前了');
  };

  return (
    <div className="group">
      <h3>備份</h3>
      <p className="tiny">資料只存在這支手機。換手機、或怕被清掉時，存一份備份檔到「檔案」。備份檔會用你設的密碼鎖起來，別人拿到檔案也看不到內容。</p>
      <p className="tiny">
        {last ? `上次匯出：${long(toKey(new Date(last.at)))}${last.sessions || last.notes ? `，之後又記了 ${[last.sessions && `${last.sessions} 次`, last.notes && `${last.notes} 則路上的事`].filter(Boolean).join('、')}` : ''}` : '還沒有匯出過備份。'}
        {kept === false && <><br />這支手機沒有答應一定保留資料，備份檔是最穩的。</>}
      </p>
      {making ? (
        <div className="backup-form">
          <input id="backup-pw" className="field" type="password" autoComplete="new-password" placeholder="備份密碼（至少 6 個字）" value={pw} onChange={e => setPw(e.target.value)} />
          <input id="backup-pw2" className="field" type="password" autoComplete="new-password" placeholder="再輸入一次" value={pw2} onChange={e => setPw2(e.target.value)} />
          <p className="tiny">忘記這組密碼，這份備份就打不開了。它跟開 App 的密碼是分開的。</p>
          <p className="tiny">檔名都是「{BACKUP_NAME}」。存到同一個資料夾時選「取代」，就只會留一份最新的。</p>
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
      {before && !restore && (
        <button className="linkish small" type="button" onClick={back}>
          回到還原前（{long(toKey(new Date(before)))} 還原之前的樣子，保留 7 天）
        </button>
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
            else await ask(b.data);
          } catch (err) {
            say(err instanceof BadBackup ? `這份備份有地方壞了（${err.message}），沒有還原` : '這個檔案不是「Mind Map」的備份');
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
        <div className="confirm restore-compare">
          <div className="compare">
            <div>
              <b>這份備份</b>
              <small>匯出於 {long(toKey(new Date(restore.diff.file.exportedAt)))}</small>
              <small>{restore.diff.file.sessions} 次{restore.diff.file.latest && ` · 最近一次 ${short(restore.diff.file.latest)}`}</small>
            </div>
            <div>
              <b>手機上現在</b>
              <small>&nbsp;</small>
              <small>{restore.diff.here.sessions} 次{restore.diff.here.latest && ` · 最近一次 ${short(restore.diff.here.latest)}`}</small>
            </div>
          </div>
          {restore.diff.onlyHere && (
            <small>
              手機上有 {restore.diff.onlyHere.count} 次（{short(restore.diff.onlyHere.from)}
              {restore.diff.onlyHere.to !== restore.diff.onlyHere.from && ` 到 ${short(restore.diff.onlyHere.to)}`}）不在這份備份裡，還原後會不見，7 天內可以回到還原前。
            </small>
          )}
          <small>用這份備份取代手機上現在的紀錄？密碼鎖照舊；換了手機的話，Face ID 要重新設定。</small>
          <div>
            <button type="button" onClick={async () => { await restoreBackup(restore.data); setRestore(null); refresh(); say('還原好了', back); }}>取代</button>
            <button type="button" onClick={() => setRestore(null)}>不要</button>
          </div>
        </div>
      )}
    </div>
  );
}
