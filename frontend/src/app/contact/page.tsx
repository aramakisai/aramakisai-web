import { getContactPage } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';

export default async function ContactPage() {
  let content;
  try {
    content = await getContactPage();
  } catch {
    return <StaticPageView title="お問い合わせ" contentHtml="" embedUrl={null} embedTitle="" />;
  }

  return (
    <StaticPageView
      title="お問い合わせ"
      contentHtml={content.contentHtml}
      embedUrl={content.embedUrl}
      embedTitle="お問い合わせフォーム"
      embedClassName="w-full h-[900px]"
    />
  );
}
