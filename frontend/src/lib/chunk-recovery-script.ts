export const CHUNK_RELOAD_STORAGE_KEY = 'aramakisai_chunk_reload_build';

// 旧ビルドのタブで /_next/static/ の取得が失敗したとき、ビルド (webpack ランタイムの script URL) ごとに
// 1 回だけ読み込み直す。同じビルドで失敗し続けても再読み込みのループにならないよう、sessionStorage で防ぐ。
// ランタイムが見つからないときは固定値 '-' で、セッション内 1 回に倒す。
// オフラインでの取得失敗は新ビルドの有無と無関係で、再読み込みしても直らず 1 回の権利を消費するだけなので何もしない
export const CHUNK_RECOVERY_SCRIPT = `
(function () {
  var KEY = '${CHUNK_RELOAD_STORAGE_KEY}';
  function isStatic(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.pathname.indexOf('/_next/static/') === 0;
  }
  var navAt = 0;
  // Next は RSC デコード中にチャンクを先読みし、その後 buildId 不一致でハードナビゲーションする。
  // 遷移中の失敗で reload すると遷移先でなく現在のページを再読み込みして遷移を上書きする。
  if (typeof navigation !== 'undefined' && navigation) {
    navigation.addEventListener('navigate', function (ev) {
      if (ev.destination && ev.destination.sameDocument === false) navAt = Date.now();
    });
  }
  function recover() {
    if (navigator.onLine === false) return;
    if (navAt && Date.now() - navAt <= 5000) return;
    try {
      var rt = document.querySelector('script[src*="/_next/static/chunks/webpack-"]');
      var build = rt ? rt.getAttribute('src') : '-';
      if (sessionStorage.getItem(KEY) === build) return;
      sessionStorage.setItem(KEY, build);
      location.reload();
    } catch (e) {}
  }
  addEventListener('error', function (ev) {
    var t = ev.target;
    if (!t || !t.tagName) return;
    if (t.tagName === 'SCRIPT' && t.src && isStatic(t.src)) recover();
    else if (t.tagName === 'LINK' && t.rel === 'stylesheet' && t.href && isStatic(t.href)) recover();
  }, true);
  addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    if (r && (r.name === 'ChunkLoadError' || /^Loading CSS chunk/.test(String(r.message)))) recover();
  });
})();
`;
