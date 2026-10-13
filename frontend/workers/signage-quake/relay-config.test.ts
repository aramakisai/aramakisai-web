import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_URLS,
  isInPeriod,
  readRelayConfig,
  type QuakeEnv,
} from './relay-config';

const base: QuakeEnv = {
  QUAKE_ACTIVE_FROM: '2026-10-23T09:00:00+09:00',
  QUAKE_ACTIVE_UNTIL: '2026-11-22T00:00:00+09:00',
  SIGNAGE_QUAKE_TOKEN: 'secret-token-value',
  DISCORD_QUAKE_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/abc',
};

function read(env: Partial<QuakeEnv> = {}) {
  const r = readRelayConfig({ ...base, ...env });
  if (!r.ok) throw new Error(`invalid: ${r.reason}`);
  return r.config;
}

afterEach(() => vi.restoreAllMocks());

describe('readRelayConfig', () => {
  it('接続先が未設定なら本番のURLで、どの系統も試験モードにならない', () => {
    const c = read();
    expect(c.urls).toEqual(PRODUCTION_URLS);
    expect(c.test).toEqual({ p2p: false, wolfxEew: false, wolfxEqlist: false });
  });

  it('接続先が本番のURLと一致しない系統だけ試験モード', () => {
    const c = read({
      QUAKE_P2P_URL: 'wss://api-realtime-sandbox.p2pquake.net/v2/ws',
    });
    expect(c.test).toEqual({ p2p: true, wolfxEew: false, wolfxEqlist: false });
    expect(c.urls.p2p).toBe('wss://api-realtime-sandbox.p2pquake.net/v2/ws');
  });

  it('本番のURLを明示しても試験モードにならない', () => {
    const c = read({ QUAKE_WOLFX_EEW_URL: PRODUCTION_URLS.wolfxEew });
    expect(c.test.wolfxEew).toBe(false);
  });

  it('空文字の接続先は未設定として扱う', () => {
    expect(read({ QUAKE_P2P_URL: '' }).test.p2p).toBe(false);
  });

  it('試験モードを直接オンにする設定は読まない', () => {
    const c = read({ QUAKE_TEST: 'true' } as Partial<QuakeEnv>);
    expect(c.test).toEqual({ p2p: false, wolfxEew: false, wolfxEqlist: false });
  });

  it('投入口は QUAKE_DEV_INJECT が "true" のときだけ', () => {
    expect(read().devInject).toBe(false);
    expect(read({ QUAKE_DEV_INJECT: 'true' }).devInject).toBe(true);
    expect(read({ QUAKE_DEV_INJECT: '1' }).devInject).toBe(false);
  });

  it('期間とトークンを読む', () => {
    const c = read();
    expect(c.activeFrom).toBe(Date.parse('2026-10-23T00:00:00Z'));
    expect(c.activeUntil).toBe(Date.parse('2026-11-21T15:00:00Z'));
    expect(c.token).toBe('secret-token-value');
  });

  it.each([
    ['期間の開始が無い', { QUAKE_ACTIVE_FROM: undefined }],
    ['期間の終端が無い', { QUAKE_ACTIVE_UNTIL: undefined }],
    ['期間の開始が解釈できない', { QUAKE_ACTIVE_FROM: 'あした' }],
    ['期間の終端が解釈できない', { QUAKE_ACTIVE_UNTIL: '2026-13-45' }],
    ['終端が開始以前', { QUAKE_ACTIVE_UNTIL: '2026-10-23T09:00:00+09:00' }],
    ['トークンが無い', { SIGNAGE_QUAKE_TOKEN: undefined }],
    ['トークンが空', { SIGNAGE_QUAKE_TOKEN: '' }],
  ])('設定が不正: %s', (_name, patch) => {
    const r = readRelayConfig({ ...base, ...patch });
    expect(r.ok).toBe(false);
  });

  it('不正な理由にトークンの値を含めない', () => {
    const r = readRelayConfig({ ...base, QUAKE_ACTIVE_FROM: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).not.toContain('secret-token-value');
  });

  describe('Webhook', () => {
    it('Discordのwebhook URLを使う', () => {
      expect(read().discordWebhookUrl).toBe(base.DISCORD_QUAKE_WEBHOOK_URL);
    });

    it('未設定なら null で警告しない', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(
        read({ DISCORD_QUAKE_WEBHOOK_URL: undefined }).discordWebhookUrl,
      ).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });

    it('形が不正なら null にするだけで設定全体は有効、警告に値を出さない', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bad = 'https://evil.example/api/webhooks/1/secretpart';
      const c = read({ DISCORD_QUAKE_WEBHOOK_URL: bad });
      expect(c.discordWebhookUrl).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]!.join(' '))).not.toContain('secretpart');
      expect(String(warn.mock.calls[0]!.join(' '))).toContain(
        'Webhookの設定が不正',
      );
    });

    it('接頭辞だけで中身が空のURLも不正', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(
        read({ DISCORD_QUAKE_WEBHOOK_URL: 'https://discord.com/api/webhooks/' })
          .discordWebhookUrl,
      ).toBeNull();
    });
  });
});

describe('isInPeriod', () => {
  const c = read();
  it('開始を含む', () => {
    expect(isInPeriod(c, c.activeFrom - 1)).toBe(false);
    expect(isInPeriod(c, c.activeFrom)).toBe(true);
  });
  it('終端を含まない', () => {
    expect(isInPeriod(c, c.activeUntil - 1)).toBe(true);
    expect(isInPeriod(c, c.activeUntil)).toBe(false);
  });
});
