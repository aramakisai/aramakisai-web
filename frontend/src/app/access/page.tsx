import type { Metadata } from 'next';
import { getAccessPage } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';

const FALLBACK_TITLE = 'アクセス';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const content = await getAccessPage();
    return { title: content.title };
  } catch {
    return { title: FALLBACK_TITLE };
  }
}

export default async function AccessPage() {
  let content;
  try {
    content = await getAccessPage();
  } catch {
    return (
      <StaticPageView
        title={FALLBACK_TITLE}
        contentHtml=""
        embedUrl={null}
        embedTitle=""
      />
    );
  }

  return (
    <StaticPageView
      title={content.title}
      contentHtml={content.contentHtml}
      embedUrl={content.embedUrl}
      embedHeight={content.embedHeight}
      embedTitle="地図"
    />
  );
}
