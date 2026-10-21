# Mind Map 的開發約定

給在這個 repo 工作的人和 Claude 看的。產品介紹見 [README](README.md)。

## 分支
- 新功能、修正都先合併到 `dev`，在 `dev` 的預覽網址試過，再開 `dev` → `main` 的 PR。
- `main` 就是正式網址，推到 `main` 會自動部署。
- `dev` → `main` 用 **Create a merge commit** 合併，不要 squash，兩條分支之後才不會分岔。其他 PR 用 squash。

## PR
- 標題和內容都用**中文**寫。
- 標題格式固定：`[標籤] 做了什麼`
  - 一句話，不加句號。
  - 一系列的 PR 在最後加 `（1/4）`，例如 `[新功能] 回頭看：這一年的天空、記下的話（1/4）`。
- 標籤只用下面這幾個，一個 PR 一個：

  | 標籤 | 用在 |
  |---|---|
  | `[新功能]` | 新的功能或畫面 |
  | `[調整]` | 改既有功能的外觀、文字或行為 |
  | `[修正]` | 修 bug |
  | `[設定]` | 部署、建置、Cloudflare、相依套件、設定檔 |
  | `[文件]` | README、這份約定、其他說明 |
  | `[整理]` | 不改行為的重構或清理 |
  | `[撤回]` | 撤回之前的 PR |
  | `[發布]` | `dev` 合併到 `main`、改版本號 |

- squash 合併時，提交標題用 PR 標題加上 `(#編號)`。
- 內容寫清楚做了什麼、怎麼檢查過（測試、截圖、模擬），以及合併後要使用者自己做的事（例如重新加入主畫面、改 Spotify 設定）。

## 合併前
- `npm test` 和 `npm run build` 都要過。
- 動到畫面的，用 Playwright 截圖看過（Chromium 在 `/opt/pw-browsers/chromium`）。

## 不要動的東西
- 資料庫名稱和儲存用的 key 都還是 `my-sky`（`src/db.ts`、`src/lib/pin.ts`、備份格式裡的 `app: 'my-sky'`）。改了會讓使用者的紀錄、密碼和舊備份讀不到。
- 改資料表要加新的 Dexie 版本（`db.version(n)`），不要改舊版本的定義。
- 備份裡不能放 `pinHash`、`faceId` 和 kv 裡的 `lockbox`（解開手機紀錄的鑰匙）。
- 設了密碼時，紀錄經過 `src/lib/seal.ts` 加密存放。新增 Dexie 索引時，那個欄位要加進 `OPEN_FIELDS`（加密的欄位不能當索引）。
