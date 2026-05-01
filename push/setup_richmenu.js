'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const GAME_URL     = process.env.GAME_URL || 'https://porschewen.github.io/GrannysGotGame/';

if (!ACCESS_TOKEN) {
  console.error('[setup] 缺少 LINE_CHANNEL_ACCESS_TOKEN');
  process.exit(1);
}

const memoryUrl      = GAME_URL;
const fruitUrl       = `${GAME_URL}fruit.html`;
const puzzle2048Url  = `${GAME_URL}2048.html`;
const wordchainUrl   = `${GAME_URL}wordchain.html`;
const sudokuUrl      = `${GAME_URL}sudoku.html`;
const shareText = encodeURIComponent(`👵 連阿嬤都贏你！來挑戰看看！\n${memoryUrl}`);
const shareUrl  = `https://line.me/R/msg/text/${shareText}`;

async function lineApi(method, endpoint, body) {
  const res = await fetch(`https://api.line.me${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LINE API ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function uploadImage(richMenuId) {
  const imgPath = path.join(__dirname, '..', 'richmenu.png');
  const img = fs.readFileSync(imgPath);
  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'image/png',
    },
    body: img,
  });
  if (!res.ok) throw new Error(`圖片上傳失敗 ${res.status}: ${await res.text()}`);
}

async function main() {
  // 清除舊的 rich menu
  const { richmenus = [] } = await lineApi('GET', '/v2/bot/richmenu/list');
  for (const rm of richmenus) {
    await lineApi('DELETE', `/v2/bot/richmenu/${rm.richMenuId}`);
    console.log(`[setup] 刪除舊 rich menu: ${rm.richMenuId}`);
  }

  // 建立新 rich menu（2500×1686，2列×3欄，6款遊戲）
  const { richMenuId } = await lineApi('POST', '/v2/bot/richmenu', {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: '連阿嬤都贏你',
    chatBarText: '🎮 選一個遊戲',
    areas: [
      // 第一列
      { bounds: { x: 0,    y: 0,   width: 833, height: 843 }, action: { type: 'uri', label: '翻牌記憶',   uri: memoryUrl } },
      { bounds: { x: 833,  y: 0,   width: 834, height: 843 }, action: { type: 'uri', label: '水果消消樂', uri: fruitUrl } },
      { bounds: { x: 1667, y: 0,   width: 833, height: 843 }, action: { type: 'uri', label: '數字拼圖',   uri: puzzle2048Url } },
      // 第二列
      { bounds: { x: 0,    y: 843, width: 833, height: 843 }, action: { type: 'uri', label: '文字接龍',   uri: wordchainUrl } },
      { bounds: { x: 833,  y: 843, width: 834, height: 843 }, action: { type: 'uri', label: '數獨',       uri: sudokuUrl } },
      { bounds: { x: 1667, y: 843, width: 833, height: 843 }, action: { type: 'uri', label: '分享遊戲',   uri: shareUrl } },
    ],
  });
  console.log(`[setup] 建立 rich menu: ${richMenuId}`);

  // 上傳圖片
  await uploadImage(richMenuId);
  console.log('[setup] 圖片上傳完成');

  // 設為所有用戶的預設
  await lineApi('POST', `/v2/bot/user/all/richmenu/${richMenuId}`);
  console.log('[setup] ✅ Rich menu 設定完成，已套用至所有用戶');
}

main().catch(e => {
  console.error('[setup] 失敗:', e.message);
  process.exit(1);
});
