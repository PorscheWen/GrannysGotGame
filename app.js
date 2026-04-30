'use strict';

// ===== 表情符號資料集 =====
const EMOJI_SETS = {
  fruits: ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍒', '🍉', '🍌', '🥝', '🍍', '🥭'],
  animals: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐸', '🦁', '🐧'],
  nature: ['🌸', '🌺', '🌻', '🌈', '⭐', '🌙', '🦋', '🍀', '🌊', '🌿', '🌴', '🌵'],
  mixed: ['🍎', '🐶', '🌸', '🎈', '🚂', '🏡', '🎵', '🎨', '🌈', '🎁', '🦄', '🚀'],
};

// 各難度牌數
const DIFFICULTY_CONFIG = {
  easy:   { pairs: 6,  cols: 3 },
  medium: { pairs: 8,  cols: 4 },
  hard:   { pairs: 12, cols: 6 },
};

const DIFFICULTY_NAMES = { easy: '初級', medium: '中級', hard: '高級' };

// ===== 遊戲狀態 =====
let state = {
  cards: [],
  flipped: [],
  matched: 0,
  flips: 0,
  totalPairs: 0,
  timerInterval: null,
  seconds: 0,
  isLocked: false,
  isRunning: false,
  timerStarted: false,
  difficulty: 'easy',
  theme: 'fruits',
  fontSize: 'large',
};

// ===== DOM 參考 =====
const $ = id => document.getElementById(id);

const DOM = {
  board: $('gameBoard'),
  timer: $('timer'),
  flipCount: $('flipCount'),
  pairsFound: $('pairsFound'),
  btnRestart: $('btnRestart'),
  btnSettings: $('btnSettings'),
  btnCloseSettings: $('btnCloseSettings'),
  settingsOverlay: $('settingsOverlay'),
  btnStartGame: $('btnStartGame'),
  winOverlay: $('winOverlay'),
  winTime: $('winTime'),
  winFlips: $('winFlips'),
  newRecordBadge: $('newRecordBadge'),
  btnShareLine: $('btnShareLine'),
  btnPlayAgain: $('btnPlayAgain'),
  btnChangeDiff: $('btnChangeDiff'),
  bestScores: $('bestScores'),
  btnClearScores: $('btnClearScores'),
  btnHelp: $('btnHelp'),
  helpOverlay: $('helpOverlay'),
  btnCloseHelp: $('btnCloseHelp'),
  btnHelpStart: $('btnHelpStart'),
  btnTrophy: $('btnTrophy'),
  trophyOverlay: $('trophyOverlay'),
  btnCloseTrophy: $('btnCloseTrophy'),
  trophyScores: $('trophyScores'),
  btnShareBest: $('btnShareBest'),
  btnClearTrophyScores: $('btnClearTrophyScores'),
};

// ===== 工具函數 =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ===== 本地儲存 =====
function loadBestScores() {
  try {
    return JSON.parse(localStorage.getItem('memory_best') || '{}');
  } catch {
    return {};
  }
}

function saveBestScore(difficulty, seconds, flips) {
  const scores = loadBestScores();
  const key = difficulty;
  const prev = scores[key];
  let isNew = false;

  if (!prev || seconds < prev.seconds || (seconds === prev.seconds && flips < prev.flips)) {
    scores[key] = { seconds, flips };
    isNew = true;
  }
  localStorage.setItem('memory_best', JSON.stringify(scores));
  return isNew;
}

function renderBestScores() {
  const scores = loadBestScores();
  const rows = Object.entries(DIFFICULTY_NAMES).map(([key, name]) => {
    const s = scores[key];
    const val = s ? `${formatTime(s.seconds)} / ${s.flips} 次` : '尚無紀錄';
    return `<div class="score-row">
      <span class="score-label">${name}</span>
      <span class="score-val">${val}</span>
    </div>`;
  }).join('');
  DOM.bestScores.innerHTML = rows || '<p style="color:var(--text-light);padding:8px 0">尚無遊戲紀錄</p>';
}

// ===== 計時器 =====
function startTimer() {
  clearInterval(state.timerInterval);
  state.seconds = 0;
  DOM.timer.textContent = '00:00';
  state.timerInterval = setInterval(() => {
    state.seconds++;
    DOM.timer.textContent = formatTime(state.seconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
}

// ===== 建立牌局 =====
function buildCards(difficulty, theme) {
  const { pairs } = DIFFICULTY_CONFIG[difficulty];
  const pool = EMOJI_SETS[theme] || EMOJI_SETS.fruits;
  const selected = pool.slice(0, pairs);
  return shuffle([...selected, ...selected]);
}

// ===== 渲染棋盤 =====
function renderBoard(emojis, difficulty) {
  const { cols } = DIFFICULTY_CONFIG[difficulty];
  DOM.board.innerHTML = '';
  DOM.board.className = `game-board ${difficulty}`;

  emojis.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'card card-enter';
    card.dataset.index = i;
    card.dataset.emoji = emoji;
    card.style.animationDelay = `${i * 0.04}s`;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', '記憶卡片（未翻開）');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front"></div>
        <div class="card-back" aria-hidden="true">${emoji}</div>
      </div>`;

    card.addEventListener('click', () => onCardClick(card));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onCardClick(card);
      }
    });

    DOM.board.appendChild(card);
  });
}

// ===== 更新統計顯示 =====
function updateStats() {
  DOM.flipCount.textContent = state.flips;
  DOM.pairsFound.textContent = `${state.matched} / ${state.totalPairs}`;
}

// ===== 翻牌邏輯 =====
function onCardClick(card) {
  if (state.isLocked) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (!state.isRunning) return;

  // 第一張牌點下才開始計時
  if (!state.timerStarted) {
    state.timerStarted = true;
    startTimer();
  }

  // 翻開卡片
  card.classList.add('flipped');
  card.setAttribute('aria-label', `${card.dataset.emoji}（已翻開）`);
  state.flipped.push(card);

  if (state.flipped.length === 1) return; // 等第二張

  // 翻了兩張
  state.flips++;
  updateStats();

  const [a, b] = state.flipped;
  state.flipped = [];

  if (a.dataset.emoji === b.dataset.emoji) {
    // 配對成功
    setTimeout(() => {
      a.classList.add('matched');
      b.classList.add('matched');
      a.setAttribute('aria-label', `${a.dataset.emoji}（已配對）`);
      b.setAttribute('aria-label', `${b.dataset.emoji}（已配對）`);
      state.matched++;
      updateStats();

      if (state.matched === state.totalPairs) {
        onGameWin();
      }
    }, 200);
  } else {
    // 配對失敗
    state.isLocked = true;
    a.classList.add('wrong');
    b.classList.add('wrong');

    setTimeout(() => {
      a.classList.remove('flipped', 'wrong');
      b.classList.remove('flipped', 'wrong');
      a.setAttribute('aria-label', '記憶卡片（未翻開）');
      b.setAttribute('aria-label', '記憶卡片（未翻開）');
      state.isLocked = false;
    }, 900);
  }
}

// ===== 遊戲勝利 =====
function onGameWin() {
  stopTimer();
  state.isRunning = false;

  const isNew = saveBestScore(state.difficulty, state.seconds, state.flips);

  setTimeout(() => {
    DOM.winTime.textContent = formatTime(state.seconds);
    DOM.winFlips.textContent = `${state.flips} 次`;
    DOM.newRecordBadge.style.display = isNew ? 'flex' : 'none';
    DOM.btnShareLine.style.display = 'block';
    DOM.winOverlay.classList.add('open');
  }, 600);
}

// ===== 開始/重新開始遊戲 =====
function startGame(difficulty, theme) {
  stopTimer();
  state.difficulty = difficulty;
  state.theme = theme;
  state.flipped = [];
  state.matched = 0;
  state.flips = 0;
  state.isLocked = false;
  state.isRunning = true;
  state.timerStarted = false;
  state.seconds = 0;
  state.totalPairs = DIFFICULTY_CONFIG[difficulty].pairs;

  const emojis = buildCards(difficulty, theme);
  state.cards = emojis;

  renderBoard(emojis, difficulty);
  updateStats();
  DOM.timer.textContent = '00:00';
  DOM.winOverlay.classList.remove('open');
}

// ===== 設定面板 =====
function openSettings() {
  renderBestScores();
  DOM.settingsOverlay.classList.add('open');
  DOM.btnCloseSettings.focus();
}

function closeSettings() {
  DOM.settingsOverlay.classList.remove('open');
  DOM.btnSettings.focus();
}

function getSelectedDifficulty() {
  return document.querySelector('input[name="difficulty"]:checked')?.value || 'easy';
}

function getSelectedTheme() {
  return document.querySelector('input[name="theme"]:checked')?.value || 'fruits';
}

// ===== 字體大小 =====
function setFontSize(size) {
  document.body.classList.remove('font-large', 'font-xlarge');
  if (size === 'large') document.body.classList.add('font-large');
  if (size === 'xlarge') document.body.classList.add('font-xlarge');
  state.fontSize = size;
  localStorage.setItem('memory_fontsize', size);

  document.querySelectorAll('.btn-font').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });
}

// ===== 最佳成績彈窗 =====
function renderTrophyScores() {
  const scores = loadBestScores();
  const diffEmoji = { easy: '🌱', medium: '🌿', hard: '🌳' };
  const rows = Object.entries(DIFFICULTY_NAMES).map(([key, name]) => {
    const s = scores[key];
    return `
      <div class="trophy-row">
        <div class="trophy-diff">
          <span class="trophy-diff-icon">${diffEmoji[key]}</span>
          <span class="trophy-diff-name">${name}</span>
        </div>
        ${s ? `
          <div class="trophy-stat"><span>⏱️</span><strong>${formatTime(s.seconds)}</strong></div>
          <div class="trophy-stat"><span>🔄</span><strong>${s.flips} 次</strong></div>
        ` : `<div class="trophy-no-record">尚無紀錄</div>`}
      </div>`;
  }).join('');
  DOM.trophyScores.innerHTML = rows;
}

function openTrophy() {
  renderTrophyScores();
  DOM.trophyOverlay.classList.add('open');
  DOM.btnCloseTrophy.focus();
}

function closeTrophy() {
  DOM.trophyOverlay.classList.remove('open');
  DOM.btnTrophy.focus();
}

function shareBestScores() {
  const scores = loadBestScores();
  const config  = window.GAME_CONFIG || {};
  const gameUrl = config.gameUrl || location.href;

  const diffName  = { easy: '初級', medium: '中級', hard: '高級' };
  const diffEmoji = { easy: '🌱', medium: '🌿', hard: '🌳' };

  const lines = Object.entries(diffName).map(([key, name]) => {
    const s = scores[key];
    return s
      ? `${diffEmoji[key]} ${name}｜${formatTime(s.seconds)}｜${s.flips} 次`
      : `${diffEmoji[key]} ${name}｜尚無紀錄`;
  });

  const text =
    `🏆 記憶訓練最佳成績\n` +
    `─────────────\n` +
    lines.join('\n') +
    `\n─────────────\n` +
    `挑戰看看！👊\n${gameUrl}`;

  window.open(`https://line.me/R/msg/text/${encodeURIComponent(text)}`, '_blank');
}

// ===== 事件綁定 =====
// ===== 說明面板 =====
function openHelp() {
  DOM.helpOverlay.classList.add('open');
  DOM.btnCloseHelp.focus();
}

function closeHelp() {
  DOM.helpOverlay.classList.remove('open');
  DOM.btnHelp.focus();
}

DOM.btnTrophy.addEventListener('click', openTrophy);
DOM.btnCloseTrophy.addEventListener('click', closeTrophy);
DOM.trophyOverlay.addEventListener('click', e => {
  if (e.target === DOM.trophyOverlay) closeTrophy();
});
DOM.trophyOverlay.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeTrophy();
});
DOM.btnShareBest.addEventListener('click', shareBestScores);
DOM.btnClearTrophyScores.addEventListener('click', () => {
  if (confirm('確定要清除所有最佳成績嗎？')) {
    localStorage.removeItem('memory_best');
    renderTrophyScores();
  }
});

DOM.btnHelp.addEventListener('click', openHelp);
DOM.btnCloseHelp.addEventListener('click', closeHelp);
DOM.helpOverlay.addEventListener('click', e => {
  if (e.target === DOM.helpOverlay) closeHelp();
});
DOM.helpOverlay.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeHelp();
});
DOM.btnHelpStart.addEventListener('click', () => {
  closeHelp();
});

DOM.btnSettings.addEventListener('click', openSettings);
DOM.btnCloseSettings.addEventListener('click', closeSettings);

DOM.settingsOverlay.addEventListener('click', e => {
  if (e.target === DOM.settingsOverlay) closeSettings();
});

DOM.settingsOverlay.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSettings();
});

DOM.btnStartGame.addEventListener('click', () => {
  const diff = getSelectedDifficulty();
  const theme = getSelectedTheme();
  closeSettings();
  startGame(diff, theme);
});

DOM.btnRestart.addEventListener('click', () => {
  startGame(state.difficulty, state.theme);
});

DOM.btnPlayAgain.addEventListener('click', () => {
  DOM.winOverlay.classList.remove('open');
  startGame(state.difficulty, state.theme);
});

DOM.btnChangeDiff.addEventListener('click', () => {
  DOM.winOverlay.classList.remove('open');
  openSettings();
});

DOM.btnShareLine.addEventListener('click', shareResult);

DOM.btnClearScores.addEventListener('click', () => {
  if (confirm('確定要清除所有最佳成績嗎？')) {
    localStorage.removeItem('memory_best');
    renderBestScores();
  }
});

// 字體大小按鈕
document.querySelectorAll('.btn-font').forEach(btn => {
  btn.addEventListener('click', () => setFontSize(btn.dataset.size));
});

// ===== Service Worker 註冊 =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ===== LIFF 分享成績 =====
function buildShareFlex(difficulty, timeStr, flips, gameUrl) {
  const diffEmoji = { easy: '🌱', medium: '🌿', hard: '🌳' };
  const diffName  = { easy: '初級', medium: '中級', hard: '高級' };
  return {
    type: 'flex',
    altText: `我完成了記憶訓練！${diffName[difficulty]} ${timeStr} / ${flips}次翻牌`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#5B6EE8', paddingAll: '20px',
        contents: [
          { type: 'text', text: '🧠 記憶訓練挑戰', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: '我完成了！你也來試試？', color: '#ddddff', size: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#f0f4ff', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: '難度', size: 'xs', color: '#8896AB' },
                  { type: 'text', text: `${diffEmoji[difficulty]} ${diffName[difficulty]}`, size: 'lg', weight: 'bold' },
                ],
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#f0f4ff', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: '時間', size: 'xs', color: '#8896AB' },
                  { type: 'text', text: `⏱️ ${timeStr}`, size: 'lg', weight: 'bold' },
                ],
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#f0f4ff', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: '翻牌', size: 'xs', color: '#8896AB' },
                  { type: 'text', text: `🔄 ${flips}次`, size: 'lg', weight: 'bold' },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [
          {
            type: 'button', style: 'primary', color: '#5B6EE8',
            action: { type: 'uri', label: '👊 我也來挑戰！', uri: gameUrl },
          },
        ],
      },
    },
  };
}

function shareResult() {
  const config  = window.GAME_CONFIG || {};
  const gameUrl = config.gameUrl || location.href;

  const diffName  = { easy: '初級', medium: '中級', hard: '高級' };
  const diffEmoji = { easy: '🌱', medium: '🌿', hard: '🌳' };
  const d = state.difficulty;

  const text =
    `🧠 記憶訓練挑戰完成！\n` +
    `${diffEmoji[d]} 難度：${diffName[d]}\n` +
    `⏱️ 時間：${DOM.winTime.textContent}\n` +
    `🔄 翻牌：${state.flips} 次\n\n` +
    `你也來挑戰！👊\n${gameUrl}`;

  window.open(`https://line.me/R/msg/text/${encodeURIComponent(text)}`, '_blank');
}

// ===== LIFF 初始化 =====
async function initLiff() {
  if (typeof liff === 'undefined') return;
  const liffId = window.GAME_CONFIG?.liffId;
  if (!liffId) return;
  try {
    await liff.init({ liffId });
    const canShare = liff.isApiAvailable('shareTargetPicker');
    state.liffReady = canShare;
    console.log('[LIFF] 初始化成功，shareTargetPicker:', canShare);
  } catch (e) {
    console.warn('[LIFF] 初始化失敗:', e.message);
  }
}

// ===== 初始化 =====
(async function init() {
  await initLiff();

  // 還原字體大小設定
  const savedFont = localStorage.getItem('memory_fontsize') || 'large';
  setFontSize(savedFont);

  // 開始預設遊戲
  startGame('easy', 'fruits');
})();
