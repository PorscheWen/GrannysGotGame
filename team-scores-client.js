'use strict';

(function () {
  function getScoreApiBase() {
    var c = window.GAME_CONFIG || {};
    var u = c.scoreApiUrl;
    if (!u) return '';
    return String(u).replace(/\/?$/, '');
  }

  window.getScoreApiBase = getScoreApiBase;

  /** 團體榜 JSON：與 gameUrl 同站的 leaderboard.json（由 GitHub Actions 提交） */
  function getLeaderboardJsonUrl() {
    var base = typeof window.getGameBaseUrl === 'function' ? window.getGameBaseUrl() : '';
    if (!base) return '';
    var p = (window.GAME_CONFIG && window.GAME_CONFIG.leaderboardDataPath) || 'leaderboard.json';
    p = String(p).replace(/^\//, '');
    return base.replace(/\/?$/, '/') + p;
  }
  window.getLeaderboardJsonUrl = getLeaderboardJsonUrl;

  function fmtTime(sec) {
    sec = Number(sec) || 0;
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function formatLineId(uid) {
    if (!uid) return '—';
    var s = String(uid);
    if (s.length <= 12) return s;
    return '…' + s.slice(-10);
  }

  function formatPlayer(row) {
    if (!row) return '—';
    var name = (row.displayName || '').trim();
    var idpart = formatLineId(row.userId);
    if (name) return name + '｜' + idpart;
    return idpart;
  }

  function formatValue(gameKey, row) {
    if (!row) return '—';
    var v = row.value;
    if (gameKey.indexOf('memory_') === 0 || gameKey.indexOf('sudoku_') === 0) {
      return fmtTime(v);
    }
    if (gameKey === 'wordchain') return v + ' 詞';
    if (gameKey === 'd2048' || gameKey === 'fruit') return v + ' 分';
    if (gameKey === 'mole') return v + ' 隻（全破累計）';
    return String(v);
  }

  window.__teamLeaderboard = window.__teamLeaderboard || null;
  window.__teamLbReady = false;
  window.__teamLeaderboardScopeKey = '_global';
  window.__teamLeaderboardScopeLabel = '🏆 團體最高分（全體 · LINE 前三名）';

  function applyLeaderboardJson(j) {
    var defaultLabel = '🏆 團體最高分（全體 · LINE 前三名）';
    var groupLabel = '🏆 團體最高分（本 LINE 群組／聊天室 · LINE 前三名）';
    if (!j) {
      window.__teamLeaderboard = null;
      window.__teamLeaderboardScopeKey = '_global';
      window.__teamLeaderboardScopeLabel = defaultLabel;
      return null;
    }
    if (j.version === 2 && j.scopes && typeof j.scopes === 'object') {
      var gid = (window.__lineCached && window.__lineCached.groupId) || '';
      if (gid && j.scopes[gid] && j.scopes[gid].games) {
        window.__teamLeaderboard = j.scopes[gid].games;
        window.__teamLeaderboardScopeKey = gid;
        window.__teamLeaderboardScopeLabel = groupLabel;
        return window.__teamLeaderboard;
      }
      var g = j.scopes._global && j.scopes._global.games;
      window.__teamLeaderboard = g || null;
      window.__teamLeaderboardScopeKey = '_global';
      window.__teamLeaderboardScopeLabel = defaultLabel;
      return window.__teamLeaderboard;
    }
    window.__teamLeaderboard = j.games || null;
    window.__teamLeaderboardScopeKey = '_global';
    window.__teamLeaderboardScopeLabel = defaultLabel;
    return window.__teamLeaderboard;
  }

  window.refreshTeamLeaderboardData = function refreshTeamLeaderboardData() {
    var url = getLeaderboardJsonUrl();
    if (!url) {
      window.__teamLeaderboard = null;
      window.__teamLeaderboardScopeKey = '_global';
      window.__teamLeaderboardScopeLabel = '🏆 團體最高分（全體 · LINE 前三名）';
      window.__teamLbReady = true;
      return Promise.resolve(null);
    }
    var prep =
      typeof window.ensureLineProfile === 'function'
        ? window.ensureLineProfile().catch(function () {
            return null;
          })
        : Promise.resolve(null);
    return prep
      .then(function () {
        return fetch(url + '?t=' + Date.now(), { mode: 'cors', cache: 'no-store' });
      })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        return applyLeaderboardJson(j);
      })
      .catch(function () {
        window.__teamLeaderboard = null;
        window.__teamLeaderboardScopeKey = '_global';
        window.__teamLeaderboardScopeLabel = '🏆 團體最高分（全體 · LINE 前三名）';
        return null;
      })
      .finally(function () {
        window.__teamLbReady = true;
      });
  };

  function loadLiffScript() {
    if (window.liff) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var profileInflight = null;

  window.ensureLineProfile = function ensureLineProfile() {
    if (window.__lineCached !== undefined) return Promise.resolve(window.__lineCached);
    if (profileInflight) return profileInflight;

    var liffId = (window.GAME_CONFIG && window.GAME_CONFIG.liffId) || '';
    if (!liffId) {
      window.__lineCached = null;
      return Promise.resolve(null);
    }

    profileInflight = loadLiffScript()
      .then(function () {
        return window.liff.init({ liffId: liffId });
      })
      .then(function () {
        if (!window.liff.isLoggedIn()) {
          window.__lineCached = null;
          return null;
        }
        return window.liff.getProfile();
      })
      .then(function (p) {
        if (!p) {
          window.__lineCached = null;
          return null;
        }
        var ctx = typeof window.liff.getContext === 'function' ? window.liff.getContext() : null;
        var gid = '';
        if (ctx) {
          if (ctx.type === 'group' && ctx.groupId) gid = String(ctx.groupId).trim();
          else if (ctx.type === 'room' && ctx.roomId) gid = String(ctx.roomId).trim();
        }
        window.__lineCached = {
          userId: p.userId,
          displayName: p.displayName || '',
          groupId: gid,
        };
        return window.__lineCached;
      })
      .catch(function () {
        window.__lineCached = null;
        return null;
      })
      .finally(function () {
        profileInflight = null;
      });

    return profileInflight;
  };

  var ANON_PLAYER_KEY = 'team_score_anon_user_id';

  /** 非 LINE 內／未設定 LIFF 時，用每瀏覽器一組穩定 ID 仍能上傳團體榜（server 只要求字串 userId） */
  function getAnonymousPlayerId() {
    try {
      var id = localStorage.getItem(ANON_PLAYER_KEY);
      if (id && id.indexOf('anon_') === 0 && id.length >= 12) return id;
      var rand;
      if (self.crypto && self.crypto.getRandomValues) {
        var bytes = new Uint8Array(16);
        self.crypto.getRandomValues(bytes);
        rand = Array.prototype.map
          .call(bytes, function (b) {
            return ('0' + b.toString(16)).slice(-2);
          })
          .join('');
      } else {
        rand = String(Date.now()) + Math.random().toString(36).slice(2, 18);
      }
      id = 'anon_' + rand;
      localStorage.setItem(ANON_PLAYER_KEY, id);
      return id;
    } catch (e) {
      return 'anon_' + String(Date.now()) + Math.random().toString(36).slice(2, 10);
    }
  }

  window.trySubmitTeamScore = function trySubmitTeamScore(opts) {
    var base = getScoreApiBase();
    if (!base || !opts || !opts.game) return Promise.resolve(false);
    /* 上傳仍走 Node（server.js 轉發 GitHub dispatch）；瀏覽器無法直連 api.github.com */

    function postScore(userId, displayName) {
      var gid =
        window.__lineCached && window.__lineCached.groupId
          ? String(window.__lineCached.groupId).trim()
          : '';
      var body = {
        userId: userId,
        displayName: displayName || '',
        game: opts.game,
        value: Number(opts.value),
        extra: opts.extra || {},
        lowerIsBetter: !!opts.lowerIsBetter,
      };
      if (gid) body.groupId = gid;
      return fetch(base + '/api/leaderboard/submit', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          return !!(j && j.ok);
        })
        .catch(function () {
          return false;
        });
    }

    return window.ensureLineProfile().then(function (prof) {
      if (prof && prof.userId) {
        return postScore(prof.userId, prof.displayName || '');
      }
      return postScore(getAnonymousPlayerId(), '訪客');
    });
  };

  window.queueSubmitTeamScore = function queueSubmitTeamScore(opts) {
    window.trySubmitTeamScore(opts).catch(function () {});
  };

  function htmlEscape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var MEDALS = ['🥇', '🥈', '🥉'];

  function top3ListHtml(gameKey, rows) {
    if (!rows || !rows.length) {
      return '<p class="ls-empty">阿嬤等你來挑戰</p>';
    }
    var lis = [];
    for (var i = 0; i < rows.length && i < 3; i++) {
      var row = rows[i];
      var medal = MEDALS[i] || i + 1 + '.';
      lis.push(
        '<li class="ls-team-li">' +
          '<span class="ls-team-medal">' +
          medal +
          '</span> ' +
          '<span class="ls-team-name">' +
          htmlEscape(formatPlayer(row)) +
          '</span>' +
          ' · <span class="ls-val">' +
          htmlEscape(formatValue(gameKey, row)) +
          '</span>' +
          '</li>'
      );
    }
    return '<ol class="ls-team-list">' + lis.join('') + '</ol>';
  }

  window.getTeamCardSummary = function getTeamCardSummary(gameId) {
    if (!getLeaderboardJsonUrl()) return '團體榜：請設定 gameUrl';
    if (!window.__teamLbReady) return '載入中…';
    var G = window.__teamLeaderboard;
    if (!G) return '阿嬤等你／妳來挑戰';

    switch (gameId) {
      case 'memory': {
        var parts = [];
        [['memory_easy', '初'], ['memory_medium', '中'], ['memory_hard', '高']].forEach(function (x) {
          var t = (G[x[0]] && G[x[0]][0]) || null;
          if (t) parts.push(x[1] + ' ' + formatValue(x[0], t));
        });
        return parts.length ? '🏆 ' + parts.join(' · ') : '阿嬤等你來挑戰';
      }
      case 'fruit': {
        var tf = (G.fruit && G.fruit[0]) || null;
        return tf ? '🏆 ' + formatValue('fruit', tf) : '阿嬤等你來挑戰';
      }
      case 'd2048': {
        var t2 = (G.d2048 && G.d2048[0]) || null;
        return t2 ? '🏆 ' + formatValue('d2048', t2) : '阿嬤等你來挑戰';
      }
      case 'sudoku': {
        var parts2 = [];
        for (var i = 0; i < 5; i++) {
          var k = 'sudoku_' + i;
          var top = (G[k] && G[k][0]) || null;
          if (top) parts2.push('第' + (i + 1) + '題 ' + formatValue(k, top));
        }
        return parts2.length ? '🏆 ' + parts2.join(' · ') : '阿嬤等你來挑戰';
      }
      case 'wordchain': {
        var tw = (G.wordchain && G.wordchain[0]) || null;
        return tw ? '🏆 ' + formatValue('wordchain', tw) : '阿嬤等你來挑戰';
      }
      case 'mole': {
        var tm = (G.mole && G.mole[0]) || null;
        return tm ? '🏆 ' + formatValue('mole', tm) : '阿嬤等你來挑戰';
      }
      default:
        return '—';
    }
  };

  window.buildTeamLobbyScoresFullHtml = function buildTeamLobbyScoresFullHtml() {
    if (!getLeaderboardJsonUrl()) {
      return (
        '<p class="ls-note">請在 <code>config.js</code> 設定 <strong>gameUrl</strong>；榜單為同站的 <code>leaderboard.json</code>（由 GitHub Actions 更新）。</p>'
      );
    }
    var G = window.__teamLeaderboard;
    if (!G) {
      return '<p class="ls-empty charm-empty">阿嬤等你／妳來挑戰</p>';
    }

    var blocks = [];

    blocks.push(
      '<div class="ls-game"><div class="ls-game-h">🧠 翻牌記憶（團體前三名）</div>' +
        '<div class="ls-team-block"><span class="ls-team-sub">初級</span>' +
        top3ListHtml('memory_easy', G.memory_easy) +
        '</div>' +
        '<div class="ls-team-block"><span class="ls-team-sub">中級</span>' +
        top3ListHtml('memory_medium', G.memory_medium) +
        '</div>' +
        '<div class="ls-team-block"><span class="ls-team-sub">高級</span>' +
        top3ListHtml('memory_hard', G.memory_hard) +
        '</div></div>'
    );

    blocks.push(
      '<div class="ls-game"><div class="ls-game-h">🍎 水果消消樂</div>' +
        top3ListHtml('fruit', G.fruit) +
        '</div>'
    );

    blocks.push(
      '<div class="ls-game"><div class="ls-game-h">🔢 數字 2048</div>' +
        top3ListHtml('d2048', G.d2048) +
        '</div>'
    );

    var sudokuParts = [];
    for (var si = 0; si < 5; si++) {
      var sk = 'sudoku_' + si;
      sudokuParts.push(
        '<div class="ls-team-block"><span class="ls-team-sub">第 ' +
          (si + 1) +
          ' 題</span>' +
          top3ListHtml(sk, G[sk]) +
          '</div>'
      );
    }
    blocks.push(
      '<div class="ls-game"><div class="ls-game-h">🎯 簡易數獨（各題前三名）</div>' +
        sudokuParts.join('') +
        '</div>'
    );

    blocks.push(
      '<div class="ls-game"><div class="ls-game-h">🔨 打地鼠</div>' +
        top3ListHtml('mole', G.mole) +
        '</div>'
    );

    blocks.push(
      '<div class="ls-game"><div class="ls-game-h">✏️ 文字接龍</div>' +
        top3ListHtml('wordchain', G.wordchain) +
        '</div>'
    );

    return blocks.join('');
  };

  window.buildTeamLobbyShareText = function buildTeamLobbyShareText() {
    var scopeNote =
      window.__teamLeaderboardScopeKey && window.__teamLeaderboardScopeKey !== '_global'
        ? '〔本群組／聊天室榜〕'
        : '〔全體榜〕';
    var lines = ['👵 連阿嬤都贏你｜團體最高分（各遊戲前三名 · LINE）' + scopeNote, ''];

    function pushLineFriendLinks() {
      if (typeof window.getLineShareLobbyUrls !== 'function') return;
      var u = window.getLineShareLobbyUrls();
      if (!u.lobby) return;
      lines.push('📎 貼給 LINE 好友（點連結即可開）：');
      lines.push('🎮 遊戲大廳 ' + u.lobby);
      lines.push('🏆 團體最高分 ' + u.scores);
      lines.push('');
    }

    pushLineFriendLinks();

    if (!getLeaderboardJsonUrl()) {
      lines.push('請在 config.js 設定 gameUrl，以載入 leaderboard.json。');
      return lines.join('\n');
    }

    var G = window.__teamLeaderboard;
    if (!G) {
      lines.push('阿嬤等你／妳來挑戰');
      return lines.join('\n');
    }

    function pushTop3(title, gameKey) {
      lines.push(title);
      var rows = G[gameKey] || [];
      if (!rows.length) {
        lines.push('  阿嬤等你來挑戰');
        lines.push('');
        return;
      }
      for (var i = 0; i < rows.length && i < 3; i++) {
        var r = rows[i];
        var who = formatPlayer(r);
        lines.push('  ' + (i + 1) + '. ' + who + ' — ' + formatValue(gameKey, r));
      }
      lines.push('');
    }

    pushTop3('🧠 翻牌｜初級', 'memory_easy');
    pushTop3('🧠 翻牌｜中級', 'memory_medium');
    pushTop3('🧠 翻牌｜高級', 'memory_hard');
    pushTop3('🍎 水果消消樂', 'fruit');
    pushTop3('🔢 2048', 'd2048');
    for (var si = 0; si < 5; si++) {
      pushTop3('🎯 數獨 第' + (si + 1) + '題', 'sudoku_' + si);
    }
    pushTop3('🔨 打地鼠', 'mole');
    pushTop3('✏️ 文字接龍', 'wordchain');

    return lines.join('\n');
  };
})();
