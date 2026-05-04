'use strict';

/**
 * 由 GitHub Actions（repository_dispatch）呼叫：合併一筆成績並寫回 leaderboard.json
 * 環境變數 CLIENT_PAYLOAD：JSON 字串
 *   { userId, displayName, game, value, extra?, groupId? }
 * groupId：LINE 群組 ID（C 開頭）或聊天室（R 開頭）；缺省或無效則寫入全體榜 _global
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'leaderboard.json');

const VALID_GAMES = new Set([
  'memory_easy', 'memory_medium', 'memory_hard',
  'fruit', 'd2048',
  'sudoku_0', 'sudoku_1', 'sudoku_2', 'sudoku_3', 'sudoku_4',
  'wordchain', 'mole',
]);

const LOWER_IS_BETTER = new Set([
  'memory_easy', 'memory_medium', 'memory_hard',
  'sudoku_0', 'sudoku_1', 'sudoku_2', 'sudoku_3', 'sudoku_4',
]);

const GLOBAL_SCOPE = '_global';

function isBetter(game, newVal, oldVal) {
  if (oldVal === undefined || oldVal === null) return true;
  if (LOWER_IS_BETTER.has(game)) return newVal < oldVal;
  return newVal > oldVal;
}

function top3ForGame(entries, game) {
  const gameMap = entries[game];
  if (!gameMap) return [];
  const lower = LOWER_IS_BETTER.has(game);
  const arr = Object.entries(gameMap).map(([userId, row]) => ({
    userId,
    displayName: row.displayName || '',
    value: row.value,
    extra: row.extra || {},
    at: row.at,
  }));
  arr.sort((a, b) => (lower ? a.value - b.value : b.value - a.value));
  return arr.slice(0, 3);
}

function rebuildGames(entries) {
  const games = {};
  for (const g of VALID_GAMES) {
    games[g] = top3ForGame(entries, g);
  }
  return games;
}

/** 僅允許 LINE 群組／聊天室 ID 當 JSON 鍵，避免任意字串污染檔案 */
function sanitizeScopeKey(raw) {
  if (raw === undefined || raw === null) return GLOBAL_SCOPE;
  const s = String(raw).trim();
  if (!s || s === GLOBAL_SCOPE) return GLOBAL_SCOPE;
  if (!/^[CR][0-9a-fA-Z_-]{8,64}$/.test(s)) return GLOBAL_SCOPE;
  return s;
}

function emptyEntriesSkeleton() {
  const entries = {};
  for (const g of VALID_GAMES) entries[g] = {};
  return entries;
}

function migrateToV2(data) {
  if (data && data.version === 2 && data.scopes && typeof data.scopes === 'object') {
    if (!data.scopes[GLOBAL_SCOPE]) {
      const entries = emptyEntriesSkeleton();
      data.scopes[GLOBAL_SCOPE] = { entries, games: rebuildGames(entries) };
    }
    return data;
  }
  const entries =
    data && data.entries && typeof data.entries === 'object' ? { ...data.entries } : {};
  for (const g of VALID_GAMES) {
    if (!entries[g] || typeof entries[g] !== 'object') entries[g] = {};
  }
  const games = rebuildGames(entries);
  return {
    ok: true,
    version: 2,
    scopes: {
      [GLOBAL_SCOPE]: { entries, games },
    },
  };
}

function ensureScope(data, scopeKey) {
  const d = migrateToV2(data);
  if (!d.scopes[scopeKey]) {
    const entries = emptyEntriesSkeleton();
    d.scopes[scopeKey] = { entries, games: rebuildGames(entries) };
  } else {
    const ent = d.scopes[scopeKey].entries;
    if (!ent || typeof ent !== 'object') d.scopes[scopeKey].entries = emptyEntriesSkeleton();
    for (const g of VALID_GAMES) {
      if (!d.scopes[scopeKey].entries[g] || typeof d.scopes[scopeKey].entries[g] !== 'object') {
        d.scopes[scopeKey].entries[g] = {};
      }
    }
  }
  return d;
}

function loadData() {
  let data = { ok: true, version: 2, scopes: {} };
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[merge-leaderboard] read failed', e.message);
    process.exit(1);
  }
  return migrateToV2(data);
}

function saveData(data) {
  const d = migrateToV2(data);
  d.ok = true;
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}

const raw = process.env.CLIENT_PAYLOAD;
if (!raw || !String(raw).trim()) {
  console.error('[merge-leaderboard] missing CLIENT_PAYLOAD');
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch (e) {
  console.error('[merge-leaderboard] invalid JSON', e.message);
  process.exit(1);
}

const { userId, displayName, game, value, extra, groupId: rawGroupId } = payload;
const num = Number(value);
if (!userId || !game || Number.isNaN(num)) {
  console.error('[merge-leaderboard] bad payload fields');
  process.exit(1);
}
if (!VALID_GAMES.has(game)) {
  console.error('[merge-leaderboard] invalid game:', game);
  process.exit(1);
}

const scopeKey = sanitizeScopeKey(rawGroupId);

const data = ensureScope(loadData(), scopeKey);
const scope = data.scopes[scopeKey];
const gameMap = scope.entries[game];
const prev = gameMap[userId];

if (!isBetter(game, num, prev?.value)) {
  console.log('[merge-leaderboard] not improved, skip write', scopeKey, game, userId);
  process.exit(0);
}

gameMap[userId] = {
  value: num,
  extra: extra && typeof extra === 'object' ? extra : {},
  at: Date.now(),
  displayName: typeof displayName === 'string' ? displayName : '',
};

scope.games = rebuildGames(scope.entries);

saveData(data);
console.log('[merge-leaderboard] updated', scopeKey, game, userId, num);
