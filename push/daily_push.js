'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const USER_ID      = process.env.LINE_USER_ID;
const LIFF_ID      = process.env.LIFF_ID;
const GAME_URL     = process.env.GAME_URL || 'https://porschewenn.github.io/Game_trainig_elder/';

if (!ACCESS_TOKEN || !USER_ID) {
  console.error('[push] 缺少 LINE_CHANNEL_ACCESS_TOKEN 或 LINE_USER_ID');
  process.exit(1);
}

const gameUrl = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : GAME_URL;

const messages = [
  {
    type: 'flex',
    altText: '🧠 今天來練習記憶力！',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#5B6EE8', paddingAll: '20px',
        contents: [
          { type: 'text', text: '🧠 每日記憶訓練', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: getTodayGreeting(), color: '#ffffffcc', size: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '每天花幾分鐘翻牌配對，幫助大腦保持靈活、提升記憶力！',
            wrap: true, size: 'md', color: '#444',
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              badge('🌱 初級', '12張牌'),
              badge('🌿 中級', '16張牌'),
              badge('🌳 高級', '24張牌'),
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [
          {
            type: 'button', style: 'primary', color: '#5B6EE8',
            action: { type: 'uri', label: '🎮 開始遊戲', uri: gameUrl },
          },
        ],
      },
    },
  },
];

function badge(title, desc) {
  return {
    type: 'box', layout: 'vertical', flex: 1,
    backgroundColor: '#f0f4ff', cornerRadius: '10px', paddingAll: '10px',
    contents: [
      { type: 'text', text: title, size: 'sm', weight: 'bold', align: 'center' },
      { type: 'text', text: desc,  size: 'xs', color: '#8896AB', align: 'center' },
    ],
  };
}

function getTodayGreeting() {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' })).getHours();
  if (hour < 12) return '早安！今天也來動動腦吧 ☀️';
  if (hour < 18) return '午安！休息一下，玩個小遊戲 🌤️';
  return '晚安！睡前動動腦，記憶更清晰 🌙';
}

async function pushMessage() {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: USER_ID, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LINE API 錯誤 ${res.status}: ${err}`);
  }
  console.log('[push] 每日提醒推播成功');
}

pushMessage().catch(e => {
  console.error('[push] 推播失敗:', e.message);
  process.exit(1);
});
