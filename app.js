'use strict';

const EMOJI_SETS = {
  fruits:  ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍒', '🍉', '🍌', '🥝', '🍍', '🥭'],
  animals: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐸', '🦁', '🐧'],
  nature:  ['🌸', '🌺', '🌻', '🌈', '⭐', '🌙', '🦋', '🍀', '🌊', '🌿', '🌴', '🌵'],
  mixed:   ['🍎', '🐶', '🌸', '🎈', '🚂', '🏡', '🎵', '🎨', '🌈', '🎁', '🦄', '🚀'],
};

const DIFFICULTY_CONFIG = {
  easy:   { pairs: 6,  cols: 3 },
  medium: { pairs: 8,  cols: 4 },
  hard:   { pairs: 12, cols: 6 },
};

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
};

const $ = id => document.getElementById(id);

const DOM = {
  board:          $('gameBoard'),
  timer:          $('timer'),
  flipCount:      $('flipCount'),
  pairsFound:     $('pairsFound'),
  btnRestart:     $('btnRestart'),
  winOverlay:     $('winOverlay'),
  winTime:        $('winTime'),
  winFlips:       $('winFlips'),
  newRecordBadge: $('newRecordBadge'),
  btnShareLine:   $('btnShareLine'),
  btnPlayAgain:   $('btnPlayAgain'),
  helpOverlay:    $('helpOverlay'),
  btnGotIt:       $('btnGotIt'),
};

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

/** 舊版或手改 localStorage 可能只有 value、或缺 flips，避免比較壞掉而永遠無法更新 */
function normalizeMemoryBestRow(row) {
  if (!row || typeof row !== 'object') return null;
  const sec = typeof row.seconds === 'number' && Number.isFinite(row.seconds)
    ? row.seconds
    : (typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : NaN);
  let fp = row.flips;
  fp = typeof fp === 'number' && Number.isFinite(fp) ? fp : parseInt(fp, 10);
  if (!Number.isFinite(sec)) return null;
  if (!Number.isFinite(fp) || fp < 0) fp = 0;
  return { seconds: sec, flips: fp };
}

function loadBestScores() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem('memory_best') || '{}'); }
  catch { return {}; }
  if (!raw || typeof raw !== 'object') return {};
  const diffs = ['easy', 'medium', 'hard'];
  let changed = false;
  for (const d of diffs) {
    if (raw[d] == null) continue;
    const n = normalizeMemoryBestRow(raw[d]);
    if (n) {
      if (raw[d].seconds !== n.seconds || raw[d].flips !== n.flips) {
        raw[d] = n;
        changed = true;
      }
    } else {
      delete raw[d];
      changed = true;
    }
  }
  if (changed) {
    try { localStorage.setItem('memory_best', JSON.stringify(raw)); } catch (_) {}
  }
  return raw;
}

function saveBestScore(difficulty, seconds, flips) {
  const scores = loadBestScores();
  const prev = normalizeMemoryBestRow(scores[difficulty]);
  let isNew = false;
  if (!prev || seconds < prev.seconds || (seconds === prev.seconds && flips < prev.flips)) {
    scores[difficulty] = { seconds, flips };
    isNew = true;
  }
  localStorage.setItem('memory_best', JSON.stringify(scores));
  if (isNew && window.queueSubmitTeamScore) {
    window.queueSubmitTeamScore({
      game: `memory_${difficulty}`,
      value: seconds,
      lowerIsBetter: true,
      extra: { flips },
    });
  }
  return isNew;
}

function startTimer() {
  clearInterval(state.timerInterval);
  state.seconds = 0;
  DOM.timer.textContent = '00:00';
  state.timerInterval = setInterval(() => {
    state.seconds++;
    DOM.timer.textContent = formatTime(state.seconds);
  }, 1000);
}

function stopTimer() { clearInterval(state.timerInterval); }

function buildCards(difficulty, theme) {
  const { pairs } = DIFFICULTY_CONFIG[difficulty];
  const pool = EMOJI_SETS[theme] || EMOJI_SETS.fruits;
  return shuffle([...pool.slice(0, pairs), ...pool.slice(0, pairs)]);
}

function renderBoard(emojis, difficulty) {
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
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(card); }
    });
    DOM.board.appendChild(card);
  });
}

function updateStats() {
  DOM.flipCount.textContent = state.flips;
  DOM.pairsFound.textContent = `${state.matched}/${state.totalPairs}`;
}

function onCardClick(card) {
  if (state.isLocked) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (!state.isRunning) return;

  if (!state.timerStarted) { state.timerStarted = true; startTimer(); }

  card.classList.add('flipped');
  card.setAttribute('aria-label', `${card.dataset.emoji}（已翻開）`);
  state.flipped.push(card);

  if (state.flipped.length === 1) return;

  state.flips++;
  updateStats();

  const [a, b] = state.flipped;
  state.flipped = [];

  if (a.dataset.emoji === b.dataset.emoji) {
    setTimeout(() => {
      a.classList.add('matched');
      b.classList.add('matched');
      a.setAttribute('aria-label', `${a.dataset.emoji}（已配對）`);
      b.setAttribute('aria-label', `${b.dataset.emoji}（已配對）`);
      state.matched++;
      updateStats();
      if (state.matched === state.totalPairs) onGameWin();
    }, 200);
  } else {
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

function onGameWin() {
  stopTimer();
  state.isRunning = false;
  const isNew = saveBestScore(state.difficulty, state.seconds, state.flips);
  setTimeout(() => {
    DOM.winTime.textContent = formatTime(state.seconds);
    DOM.winFlips.textContent = `${state.flips} 次`;
    DOM.newRecordBadge.style.display = isNew ? 'flex' : 'none';
    DOM.winOverlay.classList.add('open');
  }, 600);
}

function startGame(difficulty) {
  stopTimer();
  state.difficulty = difficulty;
  state.flipped = [];
  state.matched = 0;
  state.flips = 0;
  state.isLocked = false;
  state.isRunning = true;
  state.timerStarted = false;
  state.seconds = 0;
  state.totalPairs = DIFFICULTY_CONFIG[difficulty].pairs;
  const emojis = buildCards(difficulty, state.theme);
  renderBoard(emojis, difficulty);
  updateStats();
  DOM.timer.textContent = '00:00';
  DOM.winOverlay.classList.remove('open');
}

function shareResult() {
  const diffName = { easy: '初級', medium: '中級', hard: '高級' };
  const d = state.difficulty;
  var base = (window.getGameBaseUrl && window.getGameBaseUrl()) || '';
  var gameUrl = base ? base + 'index.html' : location.href;
  var footer = typeof window.appendLineShareLobbyFooter === 'function' ? window.appendLineShareLobbyFooter() : '';
  const txt = `🃏 翻牌記憶 ${diffName[d]}\n⏱️ 時間：${DOM.winTime.textContent}\n🔄 翻牌：${state.flips} 次\n\n來挑戰看看！👉 ${gameUrl}` + footer;
  if (window.shareTextViaLine) {
    window.shareTextViaLine(txt);
  } else if (navigator.share) {
    navigator.share({ text: txt }).catch(function () {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { alert('成績已複製到剪貼簿！'); });
  }
}

// ── Events ──
DOM.btnRestart.addEventListener('click', () => startGame(state.difficulty));
DOM.btnPlayAgain.addEventListener('click', () => {
  DOM.winOverlay.classList.remove('open');
  startGame(state.difficulty);
});
DOM.btnShareLine.addEventListener('click', shareResult);
DOM.btnGotIt.addEventListener('click', () => { DOM.helpOverlay.style.display = 'none'; });

document.querySelectorAll('.diff-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    startGame(tab.dataset.diff);
  });
});

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

// ── Init ──
(function init() {
  const savedFont = localStorage.getItem('memory_fontsize') || 'large';
  document.body.classList.remove('font-large', 'font-xlarge');
  if (savedFont === 'large') document.body.classList.add('font-large');
  if (savedFont === 'xlarge') document.body.classList.add('font-xlarge');
  startGame('easy');
})();
