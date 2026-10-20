# 安全性

Mind Map 沒有伺服器，日記只存在使用者自己的手機裡（IndexedDB）。可能的安全問題多半在：備份檔的加密、密碼鎖與 Face ID、Content-Security-Policy 等標頭（`public/_headers`），以及 Spotify 的登入流程。

## 回報問題

發現安全性問題的話，**請不要開公開的 issue**。請到這個 repo 的 **Security → Report a vulnerability** 私下回報，寫下：

- 問題是什麼、會造成什麼影響
- 重現的步驟

收到後會盡快回覆。

## 支援的版本

只維護最新的版本（`main` 分支，也就是正式網址上的版本）。
