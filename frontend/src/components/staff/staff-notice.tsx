import { StaffActionLink } from './staff-action-button';
import { StaffTitle } from './staff-heading';

export function StaffForbidden() {
  return (
    <>
      <StaffTitle>利用できません</StaffTitle>
      <p className="text-base leading-[1.7] text-text">
        実行委員のみ利用できます
      </p>
    </>
  );
}

export function StaffLoginFailed() {
  return (
    <>
      <StaffTitle>ログインに失敗しました</StaffTitle>
      <p className="text-base leading-[1.7] text-text">
        もう一度ログインしてください
      </p>
      <StaffActionLink kind="primary" href="/staff/auth/login">
        ログイン
      </StaffActionLink>
    </>
  );
}
