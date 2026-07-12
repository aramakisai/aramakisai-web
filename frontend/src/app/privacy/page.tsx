import { getPrivacyPage } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';

export default async function PrivacyPage() {
  let content;
  try {
    content = await getPrivacyPage();
  } catch {
    return <StaticPageView title="プライバシーポリシー" contentHtml="" embedUrl={null} embedTitle="" />;
  }

  return (
    <StaticPageView
      title="プライバシーポリシー"
      contentHtml={content.contentHtml}
      embedUrl={content.embedUrl}
      embedTitle=""
    />
  );
}
