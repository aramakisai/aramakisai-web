import { notFound } from 'next/navigation';
import { getTopicById } from '@/lib/topics';
import { RichText } from '@/components/rich-text';
import { AttachmentGallery } from '@/components/attachment-gallery';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TopicDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const topicId = Number(resolvedParams.id);

  if (isNaN(topicId)) {
    notFound();
  }

  const topic = await getTopicById(topicId);

  if (!topic) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold">{topic.title}</h1>
      {topic.body && <RichText html={topic.body} />}
      <AttachmentGallery attachments={topic.attachments} />
    </div>
  );
}
