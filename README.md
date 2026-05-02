# 連阿嬤都贏你 · Granny's Got Game

三代同堂都能玩的多合一小遊戲 PWA；全靜態頁面，可安裝到手機桌面。

**線上遊玩：** [https://porschewen.github.io/GrannysGotGame/](https://porschewen.github.io/GrannysGotGame/)（大廳：[games.html](https://porschewen.github.io/GrannysGotGame/games.html)）

---

## 遊戲一覽

| 遊戲 | 說明 |
|------|------|
| **翻牌記憶** | 翻開卡片，找出相同圖案；訓練短期記憶 |
| **水果消消樂** | 點選相鄰水果交換，橫或直湊滿 3 顆同色即消除；六種顏色水果 + 連鎖加分 |
| **數字拼圖 2048** | 滑動合併相同數字，挑戰 2048 |
| **簡易數獨** | 6×6 格，填入 1–6，行列不重複 |
| **打地鼠** | 目標出現就快點擊，多關卡挑戰 |
| **文字接龍** | 前一詞最後一字接下一詞開頭 |

---

## 技術概要

- **前端：** HTML5、CSS3、原生 JavaScript（無框架）
- **PWA：** `manifest.json`、`sw.js`（快取、可安裝）
- **選用後端：** Node.js + Express（`server.js`，LINE Webhook／分數 API 等；部署於 Render）
- **部署：** GitHub Pages（靜態站）

---

## 本機預覽（建議）

請勿用 `file://` 開啟，否則 Service Worker 與部分功能異常。在專案根目錄啟動任一靜態伺服器即可：

```bash
cd GrannysGotGame
python -m http.server 8765
```

瀏覽器開啟 [http://localhost:8765/games.html](http://localhost:8765/games.html) 進入遊戲大廳。

---

## 選用：LINE 後端與推播

若需本機或正式環境跑 Webhook／推播腳本：

```bash
npm install
npm install express
cp .env.example .env
# 編輯 .env 填入 LINE 等設定後：
node server.js
```

預設埠為 `PORT` 環境變數或 **3000**。`package.json` 內另有 `push` 相關 script，詳見倉庫內 `push/` 與既有設定。

---

## 授權

本專案未指定授權條款；歡迎自行研究與改作。
