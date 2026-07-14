import type { Metadata } from 'next';
import { getPrivacyPage } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';

const FALLBACK_TITLE = 'プライバシーポリシー';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const content = await getPrivacyPage();
    return { title: content.title };
  } catch {
    return { title: FALLBACK_TITLE };
  }
}

export default async function PrivacyPage() {
  let content;
  try {
    content = await getPrivacyPage();
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
      embedTitle=""
    />
  );
}
