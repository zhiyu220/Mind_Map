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
- **全部紀錄**：每一次的完整內容，可以修改、刪除。
- **設定**：下次諮商日期、Spotify、4 位數密碼鎖、匯出／還原備份、求助專線。

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

連結時會請求「控制播放」與「讀取播放狀態」兩個權限。在這個功能加入之前連結過的，要到設定裡按「重新連結」。
