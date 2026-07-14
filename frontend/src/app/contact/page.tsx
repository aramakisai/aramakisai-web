import type { Metadata } from 'next';
import { getContactPage } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';

const FALLBACK_TITLE = 'お問い合わせ';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const content = await getContactPage();
    return { title: content.title };
  } catch {
    return { title: FALLBACK_TITLE };
  }
}

export default async function ContactPage() {
  let content;
  try {
    content = await getContactPage();
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
      embedTitle="お問い合わせフォーム"
    />
  );
}
