// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PC_INPUT_QUERY, detectCapabilities } from './client-capabilities';

function stubMatchMedia(matches: (q: string) => boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: matches(q) }));
}

describe('detectCapabilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('すべて非対応の端末では 0 を返す', () => {
    stubMatchMedia(() => false);
    vi.stubGlobal('navigator', {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const dialog = (globalThis as { HTMLDialogElement?: unknown })
      .HTMLDialogElement as { prototype: { showModal?: unknown } };
    const orig = dialog.prototype.showModal;
    dialog.prototype.showModal = undefined;
    try {
      expect(detectCapabilities()).toEqual({
        cap_storage: '0',
        cap_share: '0',
        cap_clipboard: '0',
        cap_geolocation: '0',
        cap_dialog: '0',
        cap_standalone: '0',
        cap_reduced_motion: '0',
        cap_pc_input: '0',
      });
    } finally {
      dialog.prototype.showModal = orig;
    }
  });

  it('対応端末では 1 を返す', () => {
    stubMatchMedia(() => true);
    vi.stubGlobal('navigator', {
      share: () => {},
      clipboard: { writeText: () => {} },
      geolocation: {},
    });
    const caps = detectCapabilities();
    expect(caps.cap_storage).toBe('1');
    expect(caps.cap_share).toBe('1');
    expect(caps.cap_clipboard).toBe('1');
    expect(caps.cap_geolocation).toBe('1');
    expect(caps.cap_standalone).toBe('1');
    expect(caps.cap_reduced_motion).toBe('1');
    expect(caps.cap_pc_input).toBe('1');
  });

  it('iOS の navigator.standalone でも standalone と判定する', () => {
    stubMatchMedia(() => false);
    vi.stubGlobal('navigator', { standalone: true });
    expect(detectCapabilities().cap_standalone).toBe('1');
  });

  it('PC入力の条件は globals.css の pc-input と一致する', () => {
    const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
    const m = /@custom-variant pc-input \{\s*@media ([^{]+)\{/.exec(css);
    expect(m?.[1].trim()).toBe(PC_INPUT_QUERY);
  });
});
