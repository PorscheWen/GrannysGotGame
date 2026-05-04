# 連阿嬤都贏你 · Granny's Got Game

**親子同樂、好友挑戰** — 多款輕量小遊戲合集 PWA：闔家同螢幕輪流玩，或把連結丟進 LINE 群和好友比團體榜。前端全靜態，可安裝到手機桌面。

**線上遊玩：** [https://porschewen.github.io/GrannysGotGame/](https://porschewen.github.io/GrannysGotGame/) · 大廳：[games.html](https://porschewen.github.io/GrannysGotGame/games.html)

---

## 遊戲一覽

| 遊戲 | 說明 |
|------|------|
| **翻牌記憶** | 翻開卡片配對相同圖案；本機最佳時間／翻牌次數 |
| **水果消消樂** | 相鄰交換，橫或直湊滿 3 顆同色消除 |
| **數字拼圖 2048** | 滑動合併相同數字 |
| **簡易數獨** | 6×6，填入 1–6 |
| **打地鼠** | 多關卡點擊目標 |
| **文字接龍** | 詞語末字接下一詞開頭 |

---

## 設定（`config.js`）

| 欄位 | 說明 |
|------|------|
| `gameUrl` | GitHub Pages 基底網址（結尾 `/`）；榜單與分享連結用 |
| `leaderboardDataPath` | 團體榜 JSON 路徑，預設 `leaderboard.json` |
| `scoreApiUrl` | 成績上傳 API 根網址（**勿**結尾斜線）。空白則只讀榜、不上傳。應指向跑著 `server.js` 的網址 |
| `liffId` | LINE Developers → **LINE Login** channel → LIFF 的 App ID（LINE 內開啟時取得使用者與群組／聊天室 context） |

LIFF 須建立在 **LINE Login** channel（與 [Messaging API 分離政策](https://developers.line.biz/en/news/2019/11/11/liff-cannot-be-used-with-messaging-api-channels/) 一致），並與官方帳號同一 Provider 綁定。

---

## 團體榜（`leaderboard.json`）

- 由 **GitHub Actions**（`repository_dispatch` → `scripts/merge-leaderboard-submit.cjs`）寫回倉庫後隨 Pages 部署。
- **v2 格式**：`scopes._global` 為全體榜；若在 LINE **群組**或多人**聊天室**內開 LIFF 並上傳，會多一個以 `C…`／`R…` 為鍵的 scope，與全體榜分開。
- 大廳「團體最高分」分頁會依 LIFF context 顯示對應 scope；遊戲卡下方顯示 **本機最佳**（`localStorage`）與 **團體榜** 兩段摘要。

---

## 技術概要

- **前端：** HTML、CSS、原生 JavaScript（無框架）
- **PWA：** `manifest.json`、`sw.js`
- **選用後端：** Node.js 18+、`express`（`server.js`：CORS、`POST /api/leaderboard/submit` 轉發 GitHub、`POST /api/score` 記憶體成績、`POST /webhook` LINE 回覆文字成績摘要）
- **部署：** GitHub Pages（靜態）；榜單與 Actions 見 `.github/workflows/`

---

## 本機預覽

勿用 `file://`（Service Worker 與部分行為會異常）。

```bash
cd GrannysGotGame
npm install
python -m http.server 8765
```

瀏覽器開 [http://localhost:8765/games.html](http://localhost:8765/games.html)。

若要測**成績上傳**，另開終端機：

```bash
cp .env.example .env
# 編輯 .env：GITHUB_*、LINE_CHANNEL_ACCESS_TOKEN 等
node server.js
```

將 `config.js` 的 `scoreApiUrl` 設為 `http://127.0.0.1:3000`（或你的伺服器網址）。

---

## LINE 與推播

- **Rich Menu／推播腳本：** `npm run generate-richmenu`、`npm run setup-richmenu`、`npm run push` 等，見 `push/` 與 `.env.example`。
- **Webhook：** `server.js` 需設定 `LINE_CHANNEL_SECRET` 才會驗證簽章；未設定時仍回 200（僅建議開發環境）。

---

## 授權

本專案未指定授權條款；歡迎自行研究與改作。
