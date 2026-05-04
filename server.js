'use strict';

require('dotenv').config();

const express = require('express');
const https   = require('https');
const app     = express();
const PORT    = process.env.PORT || 3000;

const ACCESS_TOKEN   = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const GAME_URL       = process.env.GAME_URL || 'https://porschewen.github.io/GrannysGotGame/';

/** 轉發團體榜提交至 GitHub Actions（repository_dispatch）；勿在瀏覽器直接打 GitHub API（CORS） */
const GH_OWNER          = process.env.GITHUB_REPO_OWNER;
const GH_REPO           = process.env.GITHUB_REPO_NAME;
const GH_DISPATCH_TOKEN = process.env.GITHUB_DISPATCH_TOKEN;

// In-memory score store: Map<userId, { [game]: { value, extra, at } }>
const scoreStore = new Map();

// ── Middleware ──
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Score API（LINE／舊版客戶端） ──
app.post('/api/score', (req, res) => {
  const { userId, game, value, extra } = req.body || {};
  if (!userId || !game || value === undefined) return res.status(400).json({ ok: false });
  if (!scoreStore.has(userId)) scoreStore.set(userId, {});
  scoreStore.get(userId)[game] = { value, extra: extra || {}, at: Date.now() };
  res.json({ ok: true });
});

/**
 * 團體榜提交：轉發至 GitHub repository_dispatch → Actions 合併 leaderboard.json
 * 榜單資料存於 repo，非此伺服器檔案。
 */
/** LINE 群組（C…）或多人聊天室（R…）作為團體榜分區；無效則寫入全體 _global */
function sanitizeLeaderboardScopeId(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!/^[CR][0-9a-fA-Z_-]{8,64}$/.test(s)) return '';
  return s;
}

app.post('/api/leaderboard/submit', (req, res) => {
  const { userId, displayName, game, value, extra, groupId } = req.body || {};
  const num = Number(value);
  if (!userId || !game || Number.isNaN(num)) {
    return res.status(400).json({ ok: false, error: 'bad_request' });
  }
  if (!GH_OWNER || !GH_REPO || !GH_DISPATCH_TOKEN) {
    return res.status(503).json({ ok: false, error: 'github_dispatch_not_configured' });
  }

  const scopeId = sanitizeLeaderboardScopeId(groupId);

  const payload = JSON.stringify({
    event_type: 'leaderboard_submit',
    client_payload: {
      userId,
      displayName: typeof displayName === 'string' ? displayName : '',
      game,
      value: num,
      extra: extra && typeof extra === 'object' ? extra : {},
      ...(scopeId ? { groupId: scopeId } : {}),
    },
  });

  const reqOpts = {
    hostname: 'api.github.com',
    path: `/repos/${GH_OWNER}/${GH_REPO}/dispatches`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GH_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'GrannysGotGame-server',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const ghReq = https.request(reqOpts, (ghRes) => {
    let d = '';
    ghRes.on('data', (c) => { d += c; });
    ghRes.on('end', () => {
      if (ghRes.statusCode === 204) {
        mirrorToLegacyStore(userId, game, {
          value: num,
          extra: extra && typeof extra === 'object' ? extra : {},
          at: Date.now(),
        });
        return res.json({ ok: true });
      }
      console.error('[leaderboard/submit] GitHub', ghRes.statusCode, d);
      res.status(502).json({ ok: false, error: 'github_error' });
    });
  });
  ghReq.on('error', (e) => {
    console.error('[leaderboard/submit]', e);
    res.status(502).json({ ok: false });
  });
  ghReq.write(payload);
  ghReq.end();
});

function mirrorToLegacyStore(userId, game, row) {
  if (!userId || !row) return;
  if (!scoreStore.has(userId)) scoreStore.set(userId, {});
  const legacyKey = game === 'd2048' ? '2048' : game;
  scoreStore.get(userId)[legacyKey] = {
    value: row.value,
    extra: row.extra || {},
    at: row.at,
  };
}

// ── Health / keep-alive ──
app.get('/health', (_req, res) => res.json({ ok: true, users: scoreStore.size }));

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

  const memRows = ['easy', 'medium', 'hard'].map(d => {
    const s = scores[`memory_${d}`];
    return s ? `  ${diffName[d]}：${fmtTime(s.value)} / ${s.extra?.flips ?? '--'}次` : `  ${diffName[d]}：--`;
  }).join('\n');

  const s2048 = scores['2048'];
  const swc = scores['wordchain'];
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

function lineReply(replyToken, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ replyToken, messages });
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
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

app.listen(PORT, () => console.log(`[server] listening on ${PORT}`));
