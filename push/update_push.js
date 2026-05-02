'use strict';

/**
 * 遊戲更新通知 — 單次手動執行： node push/update_push.js
 * 內文可依每次改版修改 UPDATE_BULLETS
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const USER_ID = process.env.LINE_USER_ID;
const GAME_URL = process.env.GAME_URL || 'https://porschewen.github.io/GrannysGotGame/';

if (!ACCESS_TOKEN || !USER_ID) {
  console.error('[update_push] 缺少 LINE_CHANNEL_ACCESS_TOKEN 或 LINE_USER_ID');
  process.exit(1);
}

const gameUrl = GAME_URL;
const gamesListUrl = new URL('games.html', GAME_URL.endsWith('/') ? GAME_URL : `${GAME_URL}/`).href;

// 每次改版在此更新條列（顯示於 Flex body）
const UPDATE_BULLETS = [
  '🃏 翻牌記憶：初級／中級／高級，難度與牌數一次選好',
  '🎨 多組圖案主題：水果、動物、自然、混合，訓練專注與記憶',
  '⏱️ 計時＋翻牌次數、本機最佳紀錄，破紀錄會顯示 🏆',
  '📖 首次進入有「怎麼玩」教學彈窗，長輩也能快速上手',
  '📲 PWA 可加到主畫面；Service Worker 快取已更新，若畫面舊的請重新整理或關分頁重開',
  '📤 通關可一鍵分享成績到 LINE',
].join('\n');

const today = new Date();
const dateStr = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(today);

const messages = [
  {
    type: 'flex',
    altText: `【遊戲更新】連阿嬤都贏你 — ${dateStr}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#5B6EE8',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: '🎮 遊戲已更新', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: '連阿嬤都贏你 · 翻牌記憶', color: '#e8ecff', size: 'sm' },
          { type: 'text', text: dateStr, color: '#c8d4ff', size: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '本次重點：',
            weight: 'bold',
            size: 'md',
            color: '#333333',
          },
          {
            type: 'text',
            text: UPDATE_BULLETS,
            wrap: true,
            size: 'sm',
            color: '#444444',
            margin: 'sm',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#5B6EE8',
            action: { type: 'uri', label: '🎮 開玩翻牌記憶', uri: gameUrl },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: '🏠 遊戲首頁', uri: gamesListUrl },
          },
        ],
      },
    },
  },
];

async function pushMessage() {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: USER_ID, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LINE API 錯誤 ${res.status}: ${err}`);
  }
  console.log('[update_push] 遊戲更新推播成功');
}

pushMessage().catch(e => {
  console.error('[update_push] 推播失敗:', e.message);
  process.exit(1);
});
