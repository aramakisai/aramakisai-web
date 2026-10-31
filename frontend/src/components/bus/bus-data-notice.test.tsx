import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { BusDataNotice } from './bus-data-notice';

// 2026-10-30T10:30:00Z = JST 19:30
const FETCHED = '2026-10-30T10:30:00.000Z';
// 2026-10-30T05:17:05Z = JST 14:17:05
const GENERATED = Date.parse('2026-10-30T05:17:05Z') / 1000;

describe('BusDataNotice', () => {
  test('出典・免責・問い合わせ先・取得日時の固定文を出す', () => {
    render(
      <BusDataNotice timetableFetchedAt={FETCHED} realtimeGeneratedAt={null} />,
    );
    expect(
      screen.queryByText(
        /^このサービスは、以下の著作物を改変して利用しています。関越交通株式会社、関越交通バス・【リアルタイム情報】関越交通バス、クリエイティブ・コモンズ・ライセンス\s表示4\.0国際\(https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/deed\.ja\)$/,
      ),
    ).not.toBeNull();
    expect(
      screen.queryByText(
        /公共交通オープンデータセンターのデータを利用しています。データの正確性は保証されません。/,
      ),
    ).not.toBeNull();
    expect(
      screen
        .queryByRole('link', { name: 'お問い合わせページ' })
        ?.getAttribute('href'),
    ).toBe('/contact');
    expect(
      screen.queryByText('時刻表の取得日時: 2026/10/30 19:30'),
    ).not.toBeNull();
  });

  test('生成時刻が無いときは遅延情報の行を出さない', () => {
    render(
      <BusDataNotice timetableFetchedAt={FETCHED} realtimeGeneratedAt={null} />,
    );
    expect(screen.queryByText(/遅延情報の生成時刻/)).toBeNull();
  });

  test('生成時刻があれば JST の時分秒で出す', () => {
    render(
      <BusDataNotice
        timetableFetchedAt={FETCHED}
        realtimeGeneratedAt={GENERATED}
      />,
    );
    expect(screen.queryByText('遅延情報の生成時刻: 14:17:05')).not.toBeNull();
  });
});
