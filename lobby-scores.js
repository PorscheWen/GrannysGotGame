'use strict';

(function () {
  function fmtLobbyTime(sec) {
    sec = Number(sec) || 0;
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function normalizeMemoryRow(row) {
    if (!row || typeof row !== 'object') return null;
    var sec =
      typeof row.seconds === 'number' && isFinite(row.seconds)
        ? row.seconds
        : typeof row.value === 'number' && isFinite(row.value)
          ? row.value
          : NaN;
    var fp = row.flips;
    fp = typeof fp === 'number' && isFinite(fp) ? fp : parseInt(fp, 10);
    if (!isFinite(sec)) return null;
    if (!isFinite(fp) || fp < 0) fp = 0;
    return { seconds: sec, flips: fp };
  }

  /** 大廳遊戲卡：本機 localStorage 摘要（與各遊戲寫入鍵一致） */
  function getPersonalHighLine(gameId) {
    try {
      if (gameId === 'memory') {
        var mem = JSON.parse(localStorage.getItem('memory_best') || '{}');
        var diff = { easy: '初', medium: '中', hard: '高' };
        var parts = [];
        ['easy', 'medium', 'hard'].forEach(function (d) {
          var n = normalizeMemoryRow(mem[d]);
          parts.push(n ? diff[d] + ' ' + fmtLobbyTime(n.seconds) + '/' + n.flips + '次' : diff[d] + ' --');
        });
        return parts.join(' · ');
      }
      if (gameId === 'fruit') {
        var f = parseInt(localStorage.getItem('fruit_best') || '0', 10);
        return isFinite(f) && f > 0 ? f + ' 分' : '尚無紀錄';
      }
      if (gameId === 'd2048') {
        var t = parseInt(localStorage.getItem('game2048_best') || '0', 10);
        return isFinite(t) && t > 0 ? t + ' 分' : '尚無紀錄';
      }
      if (gameId === 'sudoku') {
        var bits = [];
        for (var si = 0; si < 5; si++) {
          var b = parseInt(localStorage.getItem('sudoku_best_' + si) || '0', 10);
          bits.push(b > 0 ? fmtLobbyTime(b) : '--');
        }
        return bits.join(' / ');
      }
      if (gameId === 'wordchain') {
        var w = parseInt(localStorage.getItem('wordchain_best') || '0', 10);
        return isFinite(w) && w > 0 ? w + ' 詞' : '尚無紀錄';
      }
      if (gameId === 'mole') {
        var m = parseInt(localStorage.getItem('mole_best') || '0', 10);
        return isFinite(m) && m > 0 ? m + ' 隻（全破累計）' : '尚無紀錄';
      }
    } catch (e) {}
    return '尚無紀錄';
  }

  window.buildLobbyShareText = function buildLobbyShareText() {
    if (typeof window.buildTeamLobbyShareText === 'function') {
      return window.buildTeamLobbyShareText();
    }
    return '👵 連阿嬤都贏你｜請載入團體榜元件';
  };

  window.refreshLobbyHighScores = function refreshLobbyHighScores() {
    var ids = ['memory', 'fruit', 'd2048', 'sudoku', 'wordchain', 'mole'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById('high-' + ids[i]);
      if (!el) continue;
      var localLine = '本機｜' + getPersonalHighLine(ids[i]);
      var teamLine =
        typeof window.getTeamCardSummary === 'function' ? window.getTeamCardSummary(ids[i]) : '團體榜載入中…';
      el.textContent = localLine + '\n' + teamLine;
    }
    var fullEl = document.getElementById('lobby-scores-full');
    if (fullEl && typeof window.buildTeamLobbyScoresFullHtml === 'function') {
      fullEl.innerHTML = window.buildTeamLobbyScoresFullHtml();
    }
    var heading = document.getElementById('lobby-scores-heading');
    if (heading && typeof window.__teamLeaderboardScopeLabel === 'string' && window.__teamLeaderboardScopeLabel) {
      heading.textContent = window.__teamLeaderboardScopeLabel;
    }
  };

  window.getLobbyScoreLine = function getLobbyScoreLine(id) {
    return typeof window.getTeamCardSummary === 'function' ? window.getTeamCardSummary(id) : '—';
  };
})();
