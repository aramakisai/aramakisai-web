import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import PrivacyPolicyPage, { metadata } from './page';

const sectionTitles = [
  '1. 取得する情報',
  '2. 利用目的',
  '3. 個人情報の管理',
  '4. 第三者への提供',
  '5. Cookieおよびアクセス解析について',
  '6. Google等の外部サービスについて',
  '7. 外部サイトへのリンク',
  '8. 免責事項',
  '9. プライバシーポリシーの変更',
  '10. お問い合わせ',
] as const;

const requiredParagraphs = [
  '群馬大学荒牧祭実行委員会（以下「当実行委員会」といいます）は、荒牧祭公式サイトにおける利用者の情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。',
  '当実行委員会は、お問い合わせフォーム等を通じて、氏名、メールアドレス、お問い合わせ内容その他フォーム上で入力いただく情報を取得することがあります。',
  'また、当サイトにアクセスした際、Cookieその他の技術を利用して、閲覧したページ、利用日時、端末・ブラウザに関する情報等を取得する場合があります。',
  '取得した情報は、以下の目的で利用します。',
  '取得した情報を、これらの目的を超えて利用することはありません。',
  '当実行委員会は、取得した個人情報について、不正アクセス、紛失、漏えい、改ざん等を防止するため、必要かつ適切な管理に努めます。',
  'また、利用目的を達成するために必要な範囲を超えて個人情報を保持しないよう努めます。',
  '当実行委員会は、取得した個人情報を、次の場合を除き、本人の同意なく第三者に提供または開示しません。',
  '当サイトでは、サイトの利用状況を把握し、内容や利便性を改善するため、Cookieその他の技術を使用する場合があります。',
  '当サイトではGoogle Analyticsを利用しており、Googleが提供する仕組みにより、端末・ブラウザに関する情報や当サイト上での利用状況等が収集されます。',
  'Cookieはブラウザの設定により無効にすることができます。ただし、Cookieを無効にした場合、当サイトまたは外部サービスの一部機能が正常に利用できない場合があります。',
  '当サイトでは、利便性向上のため、以下をはじめとする外部サービスを利用または埋め込む場合があります。',
  'これらのサービスを利用または表示した場合、各サービスの提供事業者に利用情報等が送信されることがあります。',
  '各サービスにおける情報の取扱いについては、それぞれのサービス提供事業者が定めるプライバシーポリシー等をご確認ください。',
  '当サイトには、当実行委員会以外の第三者が運営するウェブサイトやサービスへのリンクが含まれる場合があります。',
  'リンク先のウェブサイトまたはサービスにおける情報の取扱いについて、当実行委員会は責任を負いません。リンク先が定めるプライバシーポリシー等をご確認ください。',
  '当実行委員会は、当サイトに掲載する情報について、できる限り正確な情報を提供するよう努めますが、その正確性、完全性または最新性を保証するものではありません。',
  '当サイトの利用または当サイトに掲載された情報によって生じた損害について、当実行委員会は、法令上責任を負う場合を除き、責任を負いかねます。',
  '当実行委員会は、必要に応じて本ポリシーを変更することがあります。',
  '変更後の内容は、当サイト上に掲載した時点から適用します。',
  '本ポリシーに関するお問い合わせは、当サイトの「お問い合わせ」からお問い合わせフォームをご利用ください。',
] as const;

const requiredListItems = [
  'お問い合わせへの回答および必要な連絡',
  '荒牧祭の運営に必要な範囲での確認、集計および分析',
  '当サイトの利用状況の把握',
  '当サイトの利便性および内容の改善',
  'その他、取得時に明示した目的',
  '本人の同意がある場合',
  '法令に基づき提供または開示を求められた場合',
  '人の生命、身体または財産の保護のために必要であり、本人の同意を得ることが困難な場合',
  'その他、法令上認められている場合',
  'Google Forms',
  'Google Maps',
  'YouTube',
  'X',
  'Instagram',
] as const;

describe('PrivacyPolicyPage', () => {
  test('renders the complete 2026 privacy policy with semantic sections', () => {
    render(<PrivacyPolicyPage />);

    const article = screen.getByRole('article');
    expect(
      within(article).getByRole('heading', {
        level: 1,
        name: 'プライバシーポリシー',
      }),
    ).toBeInTheDocument();
    expect(
      within(article)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(sectionTitles);

    requiredParagraphs.forEach((paragraph) =>
      expect(within(article).getByText(paragraph)).toBeInTheDocument(),
    );
    requiredListItems.forEach((item) =>
      expect(within(article).getByText(item)).toBeInTheDocument(),
    );

    expect(
      within(article).getByText('制定・最終更新：2026年8月12日'),
    ).toBeInTheDocument();
    expect(
      within(article).getByText('群馬大学荒牧祭実行委員会'),
    ).toBeInTheDocument();
    expect(
      within(article).queryByText(/Google Analyticsを利用している場合/),
    ).not.toBeInTheDocument();
  });

  test('uses the restrained Mansai styling and responsive reading width', () => {
    const { container } = render(<PrivacyPolicyPage />);

    expect(screen.getByRole('main')).toHaveClass('bg-white');
    expect(screen.getByRole('article')).toHaveClass(
      'max-w-4xl',
      'px-6',
      'sm:px-8',
    );

    const titleLine = screen.getByTestId('privacy-title-line');
    expect(titleLine).toHaveClass('mansai-spectrum-line', 'h-px');
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  test('provides page metadata', () => {
    expect(metadata).toMatchObject({
      title: 'プライバシーポリシー',
      description: '荒牧祭公式サイトのプライバシーポリシー',
    });
  });
});
