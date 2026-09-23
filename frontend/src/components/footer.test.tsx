import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Footer } from './footer';
import * as snsLinksModule from '@/lib/sns-links';
import * as festivalMetaModule from '@/lib/festival-meta';
import {
  extractSectionIds,
  listAppRoutes,
  routeExists,
} from '@/lib/app-routes';

const appDir = join(process.cwd(), 'src/app');
const aboutSectionPath = join(
  process.cwd(),
  'src/components/about-section.tsx',
);

vi.mock('@/lib/sns-links', () => ({
  getSnsLinks: vi.fn(),
}));

vi.mock('@/lib/festival-meta', () => ({
  getContactFormUrl: vi.fn(),
}));

// フックの実挙動 (localStorage/matchMedia) は use-motion-preference.test.ts と
// motion-toggle.test.tsx が担うため、フッターの組み立てとしての存在確認に絞る
vi.mock('./motion-toggle', () => ({
  MotionToggle: () => <button type="button">モーション (stub)</button>,
}));

const contactFormUrl = 'https://forms.example.com/contact';

describe('Footer', () => {
  async function renderFooter(phase: 'pre_event' | 'live' = 'pre_event') {
    return render(await Footer({ phase }));
  }

  beforeEach(() => {
    vi.mocked(festivalMetaModule.getContactFormUrl).mockResolvedValue(
      contactFormUrl,
    );
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([]);
  });

  test('プライバシーポリシーは既存のルートを指す', () => {
    const routes = listAppRoutes(appDir);
    expect(routeExists(routes, '/privacy')).toBe(true);
  });

  test('「荒牧祭について」のアンカーは about-section.tsx に存在する', () => {
    const sectionIds = extractSectionIds(aboutSectionPath);
    expect(sectionIds).toContain('about');
  });

  test('開催中フェーズ: サイト案内はご案内以外の項目を子項目まで展開して表示する', async () => {
    await renderFooter('live');

    const siteGuide = screen.getByRole('navigation', {
      name: 'フッターサイト案内',
    });
    expect(
      within(siteGuide)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['企画一覧', '/exhibitions'],
      ['構内マップ', '/map'],
      ['タイムテーブル', '/timetable'],
      ['お知らせ一覧', '/announcements'],
      ['トピック', '/topics'],
    ]);
  });

  test('開催前フェーズ: サイト案内は開催前用の項目を表示する', async () => {
    await renderFooter('pre_event');

    const siteGuide = screen.getByRole('navigation', {
      name: 'フッターサイト案内',
    });
    expect(
      within(siteGuide)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['荒牧祭について', 'お知らせ', '広告協賛', '地域協賛']);
  });

  test('ご案内ブロックは「ご案内」の子項目からお問い合わせを除いたものを表示する (両フェーズ共通)', async () => {
    await renderFooter('live');

    const guidance = screen.getByRole('navigation', { name: 'フッターご案内' });
    expect(
      within(guidance)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'アクセス',
      'ご来場の際の注意点',
      '案内所・落とし物・迷子',
      'ごみの分別のお願い',
      'よくある質問',
    ]);
    expect(
      within(guidance).queryByRole('link', { name: 'お問い合わせ' }),
    ).not.toBeInTheDocument();
  });

  test('サポートブロックはお問い合わせ (外部リンクアイコン付き) とプライバシーポリシーを持つ', async () => {
    await renderFooter();

    const support = screen.getByRole('navigation', {
      name: 'フッターサポート',
    });
    const contactLink = within(support).getByRole('link', {
      name: 'お問い合わせ',
    });
    expect(contactLink).toHaveAttribute('href', contactFormUrl);
    expect(contactLink).toHaveAttribute('target', '_blank');
    expect(contactLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(contactLink).getByTestId('icon-open-in-new'),
    ).toBeInTheDocument();

    expect(
      within(support).getByRole('link', { name: 'プライバシーポリシー' }),
    ).toHaveAttribute('href', '/privacy');
  });

  test('contact_form_url が無い場合お問い合わせを表示せず、残りは維持する', async () => {
    vi.mocked(festivalMetaModule.getContactFormUrl).mockResolvedValue(null);
    await renderFooter();

    const support = screen.getByRole('navigation', {
      name: 'フッターサポート',
    });
    expect(
      within(support).queryByRole('link', { name: 'お問い合わせ' }),
    ).not.toBeInTheDocument();
    expect(
      within(support).getByRole('link', { name: 'プライバシーポリシー' }),
    ).toBeInTheDocument();
  });

  test('festival_meta の取得失敗時もお問い合わせを省略して残りを表示する', async () => {
    vi.mocked(festivalMetaModule.getContactFormUrl).mockRejectedValue(
      new Error('Directus Error'),
    );
    await renderFooter();

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'お問い合わせ' }),
    ).not.toBeInTheDocument();
  });

  test('主催者情報: ロゴ・名称・所在地・メールアドレスをアイコン付きで表示する', async () => {
    await renderFooter();

    const logo = screen.getByAltText('荒牧祭2026');
    expect(logo).toHaveAttribute(
      'src',
      expect.stringContaining('logo-2026.png'),
    );

    expect(screen.getByText('群馬大学荒牧祭実行委員会')).toBeInTheDocument();
    expect(screen.getByText(/〒371-8510/)).toBeInTheDocument();
    expect(screen.getByText(/群馬県前橋市荒牧町4-2/)).toBeInTheDocument();
    expect(screen.getByText(/mail_at_example\.invalid/)).toBeInTheDocument();
    expect(screen.getByTestId('icon-place')).toBeInTheDocument();
    expect(screen.getByTestId('icon-mail')).toBeInTheDocument();
  });

  test('公式SNS: getSnsLinks() の結果をアクセシブルな名前付きで表示する', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([
      { platform: 'X', url: 'https://x.com/aramakisai_' },
      { platform: 'Instagram', url: 'https://www.instagram.com/aramakisai_/' },
    ]);
    await renderFooter();

    expect(screen.getByText('公式SNS')).toBeInTheDocument();
    const xLink = screen.getByRole('link', { name: '荒牧祭公式X' });
    expect(xLink).toHaveAttribute('href', 'https://x.com/aramakisai_');
    expect(xLink).toHaveAttribute('target', '_blank');
  });

  test('公式SNS: リンクが空のときブロックごと非表示にする', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([]);
    await renderFooter();
    expect(screen.queryByText('公式SNS')).not.toBeInTheDocument();
  });

  test('公式SNS: 取得失敗時もブロックを非表示にし残りは維持する', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockRejectedValue(
      new Error('Directus Error'),
    );
    await renderFooter();
    expect(screen.queryByText('公式SNS')).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  test('見出しはすべて日本語で、色トークン gray-600 を使う (英字表記の SUPPORT/OFFICIAL SNS を廃する)', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([
      { platform: 'X', url: 'https://x.com/aramakisai_' },
    ]);
    await renderFooter();

    expect(screen.queryByText('SUPPORT')).not.toBeInTheDocument();
    expect(screen.queryByText('OFFICIAL SNS')).not.toBeInTheDocument();
    for (const heading of ['サイト案内', 'ご案内', 'サポート', '公式SNS']) {
      expect(screen.getByText(heading)).toHaveClass('text-gray-600');
    }
  });

  test('地はフッター専用の bansai-sage オーバーレイを持つ', async () => {
    const { container } = await renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('bg-background');
    expect(
      container.querySelector('.bg-bansai-sage\\/\\[0\\.18\\]'),
    ).toBeTruthy();
  });

  test('区切り線の下に著作権表示を置き、モーション切替を併置する', async () => {
    await renderFooter();

    expect(
      screen.getByText('© 2026 群馬大学荒牧祭実行委員会'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'モーション (stub)' }),
    ).toBeInTheDocument();
  });

  test('構内マップページでは表示されない (Footer は (fullscreen) ルートグループを通らない)', () => {
    const fullscreenLayout = join(
      process.cwd(),
      'src/app/(fullscreen)/layout.tsx',
    );
    const source = readFileSync(fullscreenLayout, 'utf-8');
    expect(source).not.toMatch(/Footer/);
  });
});
