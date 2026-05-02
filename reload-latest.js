'use strict';

/**
 * LINE／內建瀏覽器不易重整時：登錄取消 Service Worker、清空 Cache Storage，
 * 再以帶時間戳的網址 replace，盡量載入最新檔案。
 * 使用方式：按鈕 onclick="reloadGameLatest()" 或 window.reloadGameLatest()
 */
function reloadGameLatest() {
  function go() {
    try {
      var u = new URL(window.location.href);
      u.searchParams.set('_r', String(Date.now()));
      window.location.replace(u.toString());
    } catch (e) {
      window.location.reload();
    }
  }

  var chain = Promise.resolve();

  if (window.navigator && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    chain = chain.then(function () {
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(
          regs.map(function (r) {
            return r.unregister();
          })
        );
      });
    }).catch(function () {});
  }

  if (window.caches && caches.keys) {
    chain = chain.then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return caches.delete(k);
          })
        );
      });
    }).catch(function () {});
  }

  chain.then(go).catch(go);
}

window.reloadGameLatest = reloadGameLatest;
