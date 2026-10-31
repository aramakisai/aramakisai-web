import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { BusDataNotice } from './bus-data-notice';

// 2026-10-30T10:30:00Z = JST 19:30
const FETCHED = '2026-10-30T10:30:00.000Z';

describe('BusDataNotice', () => {
  test('page は遅延情報の生成時刻を出さない', () => {
    render(<BusDataNotice timetableFetchedAt={FETCHED} variant="page" />);
    expect(screen.queryByText(/遅延情報の生成時刻/)).toBeNull();
  });

  test('出典・免責・問い合わせ先・取得日時の固定文を出す', () => {
    render(<BusDataNotice timetableFetchedAt={FETCHED} variant="page" />);
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

  test('short は短い出典 1 行だけを出す', () => {
    render(<BusDataNotice timetableFetchedAt={FETCHED} variant="short" />);
    expect(
      screen.queryByText(
        'データ: 関越交通(CC BY 4.0)・公共交通オープンデータセンター',
      ),
    ).not.toBeNull();
    expect(screen.queryByText(/時刻表の取得日時/)).toBeNull();
  });
});
