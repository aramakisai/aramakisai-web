import { getAccessPage } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';

export default async function AccessPage() {
  let content;
  try {
    content = await getAccessPage();
  } catch {
    return (
      <StaticPageView
        title="アクセス"
        contentHtml=""
        embedUrl={null}
        embedTitle=""
      />
    );
  }

  return (
    <StaticPageView
      title="アクセス"
      contentHtml={content.contentHtml}
      embedUrl={content.embedUrl}
      embedTitle="地図"
    />
  );
}
