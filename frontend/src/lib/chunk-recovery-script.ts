export const CHUNK_RELOAD_STORAGE_KEY = 'aramakisai_chunk_reload_build';

// 旧ビルドのタブで /_next/static/ の取得が失敗したとき、ビルド (webpack ランタイムの script URL) ごとに
// 1 回だけ読み込み直す。同じビルドで失敗し続けても再読み込みのループにならないよう、sessionStorage で防ぐ。
// ランタイムが見つからないときは固定値 '-' で、セッション内 1 回に倒す
export const CHUNK_RECOVERY_SCRIPT = `
(function () {
  var KEY = '${CHUNK_RELOAD_STORAGE_KEY}';
  function isStatic(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.pathname.indexOf('/_next/static/') === 0;
  }
  function recover() {
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
