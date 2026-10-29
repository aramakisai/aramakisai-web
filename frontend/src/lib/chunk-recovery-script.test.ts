// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CHUNK_RECOVERY_SCRIPT,
  CHUNK_RELOAD_STORAGE_KEY,
} from './chunk-recovery-script';

const RUNTIME_A = '/_next/static/chunks/webpack-aaaa.js';
const RUNTIME_B = '/_next/static/chunks/webpack-bbbb.js';

let reload: ReturnType<typeof vi.fn>;
let listeners: [string, EventListener][];

// location.reload は jsdom で差し替えられないため、スクリプトの自由変数を引数で束縛して実行する
function runScript(nav: { onLine: boolean } = { onLine: true }) {
  const add = (type: string, fn: EventListener, capture?: boolean) => {
    listeners.push([type, fn]);
    window.addEventListener(type, fn, capture);
  };
  new Function(
    'location',
    'addEventListener',
    'navigator',
    CHUNK_RECOVERY_SCRIPT,
  )({ reload }, add, nav);
}

function setRuntime(path: string | null) {
  document.head.innerHTML = path ? `<script src="${path}"></script>` : '';
}

function failLoad(tag: 'script' | 'img', url: string) {
  const el = document.createElement(tag);
  el.setAttribute('src', url);
  document.body.appendChild(el);
  el.dispatchEvent(new Event('error'));
}

function failLink(rel: string, url: string) {
  const el = document.createElement('link');
  el.setAttribute('rel', rel);
  el.setAttribute('href', url);
  document.body.appendChild(el);
  el.dispatchEvent(new Event('error'));
}

beforeEach(() => {
  reload = vi.fn();
  listeners = [];
  sessionStorage.clear();
});

afterEach(() => {
  for (const [type, fn] of listeners)
    window.removeEventListener(type, fn, true);
  for (const [type, fn] of listeners) window.removeEventListener(type, fn);
  document.body.innerHTML = '';
});

it('/_next/static/ の script の失敗で 1 回だけ reload される', () => {
  setRuntime(RUNTIME_A);
  runScript();
  failLoad('script', '/_next/static/chunks/x.js');
  expect(reload).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBe(RUNTIME_A);
});

it('同じビルドでの 2 回目の失敗は reload されない', () => {
  setRuntime(RUNTIME_A);
  runScript();
  failLoad('script', '/_next/static/chunks/x.js');
  failLoad('script', '/_next/static/chunks/y.js');
  expect(reload).toHaveBeenCalledTimes(1);
});

it('ビルドが変われば再び reload される', () => {
  setRuntime(RUNTIME_A);
  runScript();
  failLoad('script', '/_next/static/chunks/x.js');
  setRuntime(RUNTIME_B);
  runScript();
  failLoad('script', '/_next/static/chunks/x.js');
  expect(reload).toHaveBeenCalledTimes(2);
});

it('画像の失敗では reload されない', () => {
  setRuntime(RUNTIME_A);
  runScript();
  failLoad('img', '/images/x.webp');
  failLoad('script', 'https://example.com/other.js');
  expect(reload).not.toHaveBeenCalled();
});

it('ChunkLoadError の unhandledrejection で reload される', () => {
  setRuntime(RUNTIME_A);
  runScript();
  const ev = new Event('unhandledrejection');
  Object.assign(ev, { reason: { name: 'ChunkLoadError' } });
  window.dispatchEvent(ev);
  expect(reload).toHaveBeenCalledTimes(1);
});

it('Loading CSS chunk の rejection で reload される', () => {
  setRuntime(RUNTIME_A);
  runScript();
  const ev = new Event('unhandledrejection');
  Object.assign(ev, { reason: new Error('Loading CSS chunk 12 failed.') });
  window.dispatchEvent(ev);
  expect(reload).toHaveBeenCalledTimes(1);
});

it('ランタイムが無ければセッション内 1 回だけ reload される', () => {
  setRuntime(null);
  runScript();
  failLoad('script', '/_next/static/chunks/x.js');
  failLoad('script', '/_next/static/chunks/y.js');
  expect(reload).toHaveBeenCalledTimes(1);
});

it('sessionStorage が使えなければ reload されない', () => {
  setRuntime(RUNTIME_A);
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  runScript();
  failLoad('script', '/_next/static/chunks/x.js');
  spy.mockRestore();
  expect(reload).not.toHaveBeenCalled();
});

it('/_next/static/ の stylesheet link の失敗で reload される', () => {
  setRuntime(RUNTIME_A);
  runScript();
  failLink('stylesheet', '/_next/static/css/x.css');
  expect(reload).toHaveBeenCalledTimes(1);
});

it('preload / prefetch link の失敗では reload されない', () => {
  setRuntime(RUNTIME_A);
  runScript();
  failLink('preload', '/_next/static/chunks/x.js');
  failLink('prefetch', '/_next/static/chunks/y.js');
  expect(reload).not.toHaveBeenCalled();
});

it('読み込み直し後 (スクリプト再実行、sessionStorage 保持) の同ビルドの失敗は reload されない', () => {
  setRuntime(RUNTIME_A);
  runScript();
  failLoad('script', '/_next/static/chunks/x.js');
  expect(reload).toHaveBeenCalledTimes(1);
  runScript();
  failLoad('script', '/_next/static/chunks/y.js');
  expect(reload).toHaveBeenCalledTimes(1);
});

it('navigator.onLine === false のときの失敗では reload されず sessionStorage にも書かれない', () => {
  setRuntime(RUNTIME_A);
  runScript({ onLine: false });
  failLoad('script', '/_next/static/chunks/x.js');
  expect(reload).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBeNull();
});
