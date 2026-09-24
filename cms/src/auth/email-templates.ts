export interface InvitationMailInput {
  readonly resetUrl: string;
  readonly loginUrl: string;
  readonly contactUrl?: string;
}

export function invitationSubject(): string {
  return '【荒牧祭】HP企画ページの入稿用アカウントのご案内';
}

export function invitationHtml({ resetUrl, loginUrl, contactUrl }: InvitationMailInput): string {
  const paragraphs = [
    `学生団体ご担当者様

荒牧祭実行委員会広報部です。
荒牧祭公式サイトに掲載する企画情報を入稿していただくため、CMS(コンテンツ管理システム)のアカウントを作成しました。

以下の手順でログインし、企画情報を入力してください。

1. 下記のリンクを開き、パスワードを設定してください。
   {パスワード設定リンク}
2. ログイン画面で、このメールを受信したメールアドレスと設定したパスワードを入力してください。
   {ログイン画面のURL}
3. 「学生企画」を開き、実行委員が用意した自団体の企画を編集してください。

入力した内容は、実行委員が確認したうえで公式サイトに公開します。`,
    ...(contactUrl ? [`ご不明な点は、下記のフォームからお問い合わせください。\n{問い合わせ先}`] : []),
    `なお、パスワード設定リンクは発行から72時間で無効になります。期限切れの場合は、実行委員に招待メールの再送を依頼してください。

※このメールは送信専用のアドレスから送信しています。

荒牧祭実行委員会広報部`,
  ];

  return paragraphs
    .join('\n\n')
    .replaceAll('{パスワード設定リンク}', `<a href="${resetUrl}">${resetUrl}</a>`)
    .replaceAll('{ログイン画面のURL}', `<a href="${loginUrl}">${loginUrl}</a>`)
    .replaceAll('{問い合わせ先}', contactUrl ? `<a href="${contactUrl}">${contactUrl}</a>` : '')
    .replaceAll('\n', '<br>\n');
}
