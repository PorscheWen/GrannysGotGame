// 部署後請改成你的 GitHub Pages 基底網址（分享成績連結用）
window.GAME_CONFIG = {
  gameUrl: 'https://porschewen.github.io/GrannysGotGame/',
  /** 團體榜靜態檔，與 gameUrl 同庫，由 GitHub Actions 寫入後一併部署到 Pages */
  leaderboardDataPath: 'leaderboard.json',
  /**
   * 成績上傳用（勿結尾斜線）。因瀏覽器無法直連 GitHub API，須由 Node（server.js）轉發 repository_dispatch。
   * 空白則僅顯示榜單、無法從遊戲上傳。本機有跑 server.js 時可設：http://127.0.0.1:3000
   * 在 LINE 內若已設定 liffId 會以上傳 LINE 身份為主；一般瀏覽器則用本地匿名 ID 仍可上傳。
   * 從 LINE「群組」或多人「聊天室」內開啟 LIFF 時，成績會寫入該群／室的獨立團體榜（leaderboard.json scopes）；一對一或外部瀏覽器則為全體榜 _global。
   */
  scoreApiUrl: '',
  /** LINE Developers → LIFF → App ID（Elder_Training / GrannysGotGame） */
  liffId: '2009935174-67Y6JKOs',
};

/** 正規化基底網址（結尾保留單一 /） */
window.getGameBaseUrl = function getGameBaseUrl() {
  var g = window.GAME_CONFIG && window.GAME_CONFIG.gameUrl;
  if (g) return g.replace(/\/?$/, '/');
  if (typeof location !== 'undefined') {
    var p = location.pathname.replace(/[^/]+$/, '');
    return location.origin + p;
  }
  return '';
};

/**
 * LINE 分享用：完整 https 網址，好友在聊天室點選可開啟
 * @returns {{ lobby: string, scores: string }}
 */
window.getLineShareLobbyUrls = function getLineShareLobbyUrls() {
  var base = '';
  if (typeof window.getGameBaseUrl === 'function') {
    base = window.getGameBaseUrl().replace(/\/?$/, '');
  }
  if (!base && typeof location !== 'undefined') {
    base = (location.origin + location.pathname.replace(/[^/]*$/, '')).replace(/\/?$/, '');
  }
  if (!base) return { lobby: '', scores: '' };
  var lobby = base + '/games.html';
  return { lobby: lobby, scores: lobby + '#scores' };
};

/** 附加在分享文字結尾：遊戲大廳 + 團體最高分（給 LINE 好友） */
window.appendLineShareLobbyFooter = function appendLineShareLobbyFooter() {
  var u = window.getLineShareLobbyUrls();
  if (!u.lobby) return '';
  return (
    '\n\n📎 給 LINE 好友：\n' +
    '🎮 遊戲大廳 ' +
    u.lobby +
    '\n' +
    '🏆 團體最高分 ' +
    u.scores
  );
};

/**
 * 開啟 LINE 分享畫面（line.me/R/share）
 * LINE 內建瀏覽器常擋 window.open → 改同頁導向；桌面則先試另開分頁。
 */
window.shareTextViaLine = function shareTextViaLine(text) {
  var lineUrl = 'https://line.me/R/share?text=' + encodeURIComponent(text);
  var ua = navigator.userAgent || '';
  var isLineInApp = /Line\//i.test(ua);
  var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  /* LINE 內建：同頁跳轉最穩，會開起選擇聊天室／分享 */
  if (isLineInApp) {
    window.location.assign(lineUrl);
    return;
  }

  /* 手機外部瀏覽器：優先導向 line.me（常會喚起 LINE App） */
  if (isMobile) {
    window.location.assign(lineUrl);
    return;
  }

  /* 桌面：另開分頁 */
  try {
    var w = window.open(lineUrl, '_blank', 'noopener,noreferrer');
    if (w) return;
  } catch (e) {}

  try {
    var a = document.createElement('a');
    a.href = lineUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  } catch (e2) {}

  window.location.assign(lineUrl);
};

/** 若完全無法離開頁面時的後備（一般不會走到） */
window.shareTextFallback = function shareTextFallback(text) {
  if (navigator.share) {
    navigator.share({ text: text }).catch(function () {
      fallbackClipboard(text);
    });
  } else {
    fallbackClipboard(text);
  }
};

function fallbackClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      alert('已複製成績，請貼到 LINE 與好友分享');
    }).catch(function () {
      promptCopy(text);
    });
  } else {
    promptCopy(text);
  }
}

function promptCopy(text) {
  window.prompt('請複製以下文字到 LINE：', text);
}
