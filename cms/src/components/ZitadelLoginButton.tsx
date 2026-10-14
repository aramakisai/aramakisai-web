export default function ZitadelLoginButton() {
  return (
    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
      {/* API ルートへのフルナビゲーションが必要なため next/link は使えない */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/auth/authentik"
        className="btn btn--style-secondary btn--size-large"
        style={{ display: 'inline-block', width: '100%' }}
      >
        荒牧祭SSOでログイン
      </a>
    </div>
  );
}
