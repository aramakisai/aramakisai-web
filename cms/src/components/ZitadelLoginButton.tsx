export default function ZitadelLoginButton() {
  return (
    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
      <a
        href="/api/auth/authentik"
        className="btn btn--style-secondary btn--size-large"
        style={{ display: 'inline-block', width: '100%' }}
      >
        Zitadel でログイン
      </a>
    </div>
  );
}
