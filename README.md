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

## 部署

`main` 分支有新的 commit 時，`.github/workflows/deploy.yml` 會打包並發布到 GitHub Pages：

1. 到 repo 的 **Settings → Pages**，把 **Source** 設成 **GitHub Actions**。
2. 合併到 `main` 之後，網址會是 `https://<帳號>.github.io/mindweb_mymap/`。

> 私人 repo 要用 GitHub Pages 需要付費方案。也可以把 repo 設成公開（日記內容只在手機裡，不在 repo 中），或改用 Vercel／Netlify／Cloudflare Pages 等免費服務連結這個 repo（打包指令 `npm run build`、輸出資料夾 `dist`）。

## 在 iPhone 上安裝

用 **Safari** 打開網址 → 下方「分享」→「加入主畫面」。

> 「加入主畫面」的 App 和 Safari 的資料是分開的。請一直從主畫面的圖示打開，並偶爾在設定裡「匯出備份」存到「檔案」。

## 連結 Spotify（可選）

不連結也可以：記錄時貼上 Spotify 的歌曲連結即可。連結之後能直接用歌名搜尋：

1. 到 [Spotify for Developers](https://developer.spotify.com/dashboard) 建立一個 App（給自己用的開發模式即可），API 勾選 **Web API**。
2. **Redirect URI** 填 App 設定頁顯示的網址（例如 `https://<帳號>.github.io/mindweb_mymap/`）。
3. 把 **Client ID** 貼到 App 的「設定 → Spotify」，再按「連結 Spotify」。

只用到搜尋，不需要任何特殊權限；播放使用 Spotify 官方嵌入播放器，沒登入時可能只能試聽片段，旁邊有「在 Spotify 打開」。
