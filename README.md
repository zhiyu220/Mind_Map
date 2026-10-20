# 我的天空

記住每一次諮商心情的 iPhone Web App（PWA）。繪本風的小路上，一個實心圓點是一次諮商，虛線圓點是兩次諮商之間的路上。

- 資料只存在自己的手機（IndexedDB），不需要帳號、沒有伺服器。
- 可以「加入主畫面」，像一般 App 一樣打開，沒有網路也能用。
- 產品構想與製作地圖：[`docs/ROADMAP.md`](docs/ROADMAP.md)；最早的樣稿：[`mockup/home.html`](mockup/home.html)。

## 功能

- **小路首頁**：橫向可以滑的繪本風景，小人站在最新的一次諮商上。上方的話來自自己的紀錄（幾天前、上次的天氣、下次諮商、記過的金句），一天換一句，點一下可以看下一句。
- **記下今天**：先問「今天有去諮商嗎？」
  - 有：一題一頁，只有天氣必選——天氣、心情、談了什麼（可自己新增）、印象最深的一句話、筆記、這次的歌。隨時可以「先存起來」，之後再補。
  - 沒有：記在「路上」，一句話或只點天氣都可以；加星星的，下次諮商前會拿出來。
- **全部紀錄**：每一次的完整內容，可以修改（包括日期）、刪除。也可以「補記以前的諮商」和「補記路上的事」：選那天的日期，點會照日期插進小路中間，那段路上之後的事會跟著分到新的點後面。
- **設定**：下次諮商日期、Spotify、4 位數密碼鎖、匯出／還原備份、求助專線。

## 隱私與安全

日記只存在你的手機裡，沒有伺服器。主要防的是「別人拿到手機」和「備份檔外流」：
- **備份檔加密**：匯出時要設一組密碼（至少 6 個字），檔案用 AES-GCM 加密，金鑰由密碼經 PBKDF2（60 萬次）產生；沒有密碼看不到內容。舊的未加密備份仍可還原（`src/lib/crypto.ts`）。
- **背景時遮住畫面**：App 一離開前景就蓋上一片天空，多工畫面的截圖看不到內容（`src/lib/privacy.ts`）。
- **密碼猜錯要等**：4 位數密碼錯 5 次後要等 30 秒，之後每錯一次等待加倍，最多 15 分鐘；重開 App 不會重置。
- **安全標頭**（`public/_headers`）：只執行本站的程式、只連到 Spotify、不允許別的網站嵌入這個 App（CSP、X-Frame-Options 等）。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 單元測試
npm run build      # 型別檢查＋打包到 dist/
npm run icons      # 從 public/icons/favicon.svg 產生 PNG 圖示
```

技術：Vite + React + TypeScript、Dexie（IndexedDB）、vite-plugin-pwa。風景是程式畫的 SVG，手繪的歪斜感直接畫進形狀裡（不用即時濾鏡），在 iPhone 上捲動才會順。

## 部署（Cloudflare）

用 **Workers**（`wrangler.jsonc` 已設定好，只發布 `dist/` 的靜態檔案）：

1. 登入 [Cloudflare](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Import a repository**，選這個 repo（私人 repo 也可以）。
2. 在 Worker 的 **Settings → Build** 確認 Deploy command 是 `npx wrangler deploy`、Root directory 是 `/`。Build command 可以留空：`wrangler.jsonc` 會在部署前自己執行 `npm run build`。
3. 網址會是 `https://mindweb-mymap.<帳號>.workers.dev/`。

也可以改用 **Pages**：Build command `npm run build`、Build output directory `dist`、環境變數 `NODE_VERSION` = `22`，網址是 `https://<專案名稱>.pages.dev/`。

之後每次推到 `main` 會自動更新；推到其他分支會產生一個預覽網址。`public/_headers` 讓 App 本體和 service worker 不被快取太久，更新才會送到手機上。

## 在 iPhone 上安裝

用 **Safari** 打開網址 → 下方「分享」→「加入主畫面」。

> 「加入主畫面」的 App 和 Safari 的資料是分開的。請一直從主畫面的圖示打開，並偶爾在設定裡「匯出備份」存到「檔案」。

更新不用重新加入主畫面：App 每次打開或切回前景時都會檢查新版本。剛打開時發現就直接換上；用到一半才發現的，等你離開 App 時才換，不會打斷正在寫的紀錄（`src/lib/update.ts`）。只有改了圖示或名稱時，才需要重新加入主畫面。

## 連結 Spotify（可選）

不連結也可以：記錄時貼上 Spotify 的歌曲連結即可。連結之後能直接用歌名搜尋：

1. 到 [Spotify for Developers](https://developer.spotify.com/dashboard) 建立一個 App（給自己用的開發模式即可），API 勾選 **Web API**。
2. **Redirect URI** 填 App 設定頁顯示的網址（例如 `https://mindweb-mymap.<帳號>.workers.dev/`）。
3. 把 **Client ID** 貼到 App 的「設定 → Spotify」，再按「連結 Spotify」。

建立 App 時只要勾 **Web API**（Web Playback SDK 不支援手機瀏覽器，用不到）。

播放有三種：
- **Spotify 官方嵌入播放器**：在 iPhone 上通常只能試聽片段。
- **用我的 Spotify 播完整首**（需要 Premium）：App 遙控你手機上的 Spotify 播這首歌，可以繼續留在 App 裡。Spotify 要最近打開過才找得到；找不到時先打開 Spotify 一下再按。
- **在 Spotify 打開**：直接跳到 Spotify。

連結之後還有：
- **剛剛聽的歌**：「這次的歌」打開時，最上面列出正在聽和最近聽過的歌，點一下就選好。
- **封面**：小路上的對話框、全部紀錄和每月回顧都會顯示歌的封面，點一下就能聽。
- **路上也能附一首歌**：「路上」的紀錄可以按「♪ 加一首歌」。
- **那天的歌**：首頁的話偶爾會變成「10/15 那天聽的是〈魚仔〉」，旁邊有「♪ 聽聽看」。
- **每月回顧**：全部紀錄裡的「每月回顧」，照月份整理每次的天氣、這個月的歌（含路上的）和記下的話。
- **「我的天空」歌單**：每次紀錄附上的歌，會自動照諮商的日期排進你 Spotify 裡的一個私人歌單；修改、刪除紀錄也會跟著更新。可以在設定裡關掉。在 Spotify 裡把歌單刪掉的話，下次會重新建立。

連結時會請求：控制播放、讀取播放狀態、讀取正在播放與最近播放、讀取與編輯私人歌單。在這些功能加入之前連結過的，要到設定裡按「重新連結」。
