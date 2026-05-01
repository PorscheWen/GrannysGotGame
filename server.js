'use strict';

require('dotenv').config();

const express = require('express');
const crypto  = require('https');   // reuse below
const https   = require('https');
const app     = express();
const PORT    = process.env.PORT || 3000;

const ACCESS_TOKEN   = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const GAME_URL       = process.env.GAME_URL || 'https://porschewen.github.io/GrannysGotGame/';

// In-memory score store: Map<userId, { [game]: { value, extra, at } }>
const scoreStore = new Map();

// ── Middleware ──
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://porschewen.github.io');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Score API ──
app.post('/api/score', (req, res) => {
  const { userId, game, value, extra } = req.body || {};
  if (!userId || !game || value === undefined) return res.status(400).json({ ok: false });
  if (!scoreStore.has(userId)) scoreStore.set(userId, {});
  scoreStore.get(userId)[game] = { value, extra: extra || {}, at: Date.now() };
  res.json({ ok: true });
});

// ── Health / keep-alive ──
app.get('/health', (_req, res) => res.json({ ok: true, scores: scoreStore.size }));

// ── LINE Webhook ──
app.post('/webhook', (req, res) => {
  if (CHANNEL_SECRET) {
    const sig = require('crypto').createHmac('sha256', CHANNEL_SECRET)
      .update(req.rawBody).digest('base64');
    if (req.headers['x-line-signature'] !== sig) return res.sendStatus(403);
  }
  res.sendStatus(200);
  const events = req.body?.events || [];
  for (const ev of events) {
    if (ev.type === 'message') handleMessage(ev).catch(() => {});
  }
});

async function handleMessage(ev) {
  const userId = ev.source?.userId;
  if (!userId || !ev.replyToken) return;
  const scores = scoreStore.get(userId) || {};
  await lineReply(ev.replyToken, [buildScoreMessage(scores)]);
}

// ── Score message builder ──
function fmtTime(secs) {
  if (!secs && secs !== 0) return '--:--';
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function buildScoreMessage(scores) {
  const diffName = { easy: '初級', medium: '中級', hard: '高級' };

  // 翻牌記憶
  const memRows = ['easy', 'medium', 'hard'].map(d => {
    const s = scores[`memory_${d}`];
    return s ? `  ${diffName[d]}：${fmtTime(s.value)} / ${s.extra?.flips ?? '--'}次` : `  ${diffName[d]}：--`;
  }).join('\n');

  // 2048
  const s2048 = scores['2048'];

  // 文字接龍
  const swc = scores['wordchain'];

  // 數獨
  const sudokuRows = [0, 1, 2, 3, 4].map(i => {
    const ss = scores[`sudoku_${i}`];
    return `  第${i + 1}題：${ss ? fmtTime(ss.value) : '--:--'}`;
  }).join('\n');

  const hasAny = Object.keys(scores).length > 0;

  const text = hasAny
    ? [
        '🏆 你的遊戲最高成績',
        '',
        '🃏 翻牌記憶',
        memRows,
        '',
        `🔢 數字拼圖 2048：${s2048 ? s2048.value + ' 分' : '--'}`,
        '',
        `💬 文字接龍：${swc ? swc.value + ' 個詞語' : '--'}`,
        '',
        '🔢 簡易數獨',
        sudokuRows,
        '',
        `👉 ${GAME_URL}`,
      ].join('\n')
    : `你還沒有成績紀錄！快去玩遊戲吧 🎮\n👉 ${GAME_URL}`;

  return { type: 'text', text };
}

// ── LINE Reply API ──
function lineReply(replyToken, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ replyToken, messages });
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Self keep-alive (Render free tier stays awake) ──
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    https.get(`${process.env.RENDER_EXTERNAL_URL}/health`, () => {}).on('error', () => {});
  }, 14 * 60 * 1000);
}

app.listen(PORT, () => console.log(`[server] listening on ${PORT}`));
