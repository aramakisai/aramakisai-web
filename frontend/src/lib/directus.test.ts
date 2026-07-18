import { createDirectus, rest, readSingleton, readItems } from '@directus/sdk';
import type { Schema } from './directus';
import { test } from 'vitest';

test('Directus schema type checks', async () => {
  const mockDirectus = createDirectus<Schema>('http://localhost').with(rest());

  // 型チェックのみが目的で、実行時にネットワークへは到達しないことを期待する呼び出し。
  const typecheck = async () => {
    // 正常なクエリ
    await mockDirectus.request(
      readSingleton('page_home', {
        fields: ['id', 'hero_message'],
      }),
    );

    await mockDirectus.request(
      readItems('announcements', {
        fields: ['id', 'title'],
      }),
    );

    await mockDirectus.request(
      readSingleton('page_home', {
        // @ts-expect-error: 存在しないフィールド
        fields: ['invalid_field'],
      }),
    );

    // @ts-expect-error: 存在しないコレクション
    await mockDirectus.request(readSingleton('invalid_collection'));
  };
  void typecheck;
});
