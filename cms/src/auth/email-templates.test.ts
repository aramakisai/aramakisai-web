import { describe, expect, it } from 'vitest';

import { invitationHtml, invitationSubject } from './email-templates';

describe('invitationSubject', () => {
  it('M-01 の件名を返す', () => {
    expect(invitationSubject()).toBe('【荒牧祭】HP企画ページの入稿用アカウントのご案内');
  });
});

describe('invitationHtml', () => {
  const html = invitationHtml({
    resetUrl: 'https://cms.aramakisai.com/admin/reset/token123',
    loginUrl: 'https://cms.aramakisai.com/admin/login',
    contactUrl: 'https://aramakisai.com/contact',
  });

  it('3 つのリンクを含む', () => {
    expect(html).toContain('<a href="https://cms.aramakisai.com/admin/reset/token123">');
    expect(html).toContain('<a href="https://cms.aramakisai.com/admin/login">');
    expect(html).toContain('<a href="https://aramakisai.com/contact">');
  });

  it('M-02 の全文を含む', () => {
    expect(html).toContain('学生団体ご担当者様');
    expect(html).toContain('荒牧祭実行委員会広報部です。');
    expect(html).toContain(
      '荒牧祭公式サイトに掲載する企画情報を入稿していただくため、CMS(コンテンツ管理システム)のアカウントを作成しました。',
    );
    expect(html).toContain('以下の手順でログインし、企画情報を入力してください。');
    expect(html).toContain('1. 下記のリンクを開き、パスワードを設定してください。');
    expect(html).toContain(
      '2. ログイン画面で、このメールを受信したメールアドレスと設定したパスワードを入力してください。',
    );
    expect(html).toContain('3. 「学生企画」を開き、実行委員が用意した自団体の企画を編集してください。');
    expect(html).toContain('入力した内容は、実行委員が確認したうえで公式サイトに公開します。');
    expect(html).toContain('ご不明な点は、下記のフォームからお問い合わせください。');
    expect(html).toContain(
      'なお、パスワード設定リンクは発行から72時間で無効になります。期限切れの場合は、実行委員に招待メールの再送を依頼してください。',
    );
    expect(html).toContain('※このメールは送信専用のアドレスから送信しています。');
    expect(html).toContain('荒牧祭実行委員会広報部');
  });

  it('改行を <br> にする', () => {
    expect(html).toContain('<br>');
  });
});
