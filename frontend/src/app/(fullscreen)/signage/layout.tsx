import { ContextMenuGuard } from '@/components/signage/context-menu-guard';

export default function SignageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ContextMenuGuard />
      {/* 無人運用の端末で長押しや誤タップによる選択・メニュー表示を出さない。layout の外では効かせない。入力欄は親の none を継ぐため text を明示する */}
      <style>
        {
          '*:not(input,textarea){user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}input,textarea{user-select:text;-webkit-user-select:text}'
        }
      </style>
      {children}
    </>
  );
}
