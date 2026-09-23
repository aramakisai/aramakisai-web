/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { ImageIcon } from './icons';

export interface TopicCardProps {
  readonly id: number;
  readonly title: string;
  readonly imageId: string | null;
}

export function TopicCard({ id, title, imageId }: TopicCardProps) {
  const thumbnailUrl = imageId ? toAssetUrl(imageId, 960) : null;

  return (
    <Link
      href={`/topics/${id}`}
      className="relative flex aspect-[4/3] w-full items-end overflow-clip rounded-xl px-4 pb-4 transition-shadow hover:shadow-lg"
    >
      <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon size={40} className="text-gray-400" />
        )}
      </div>
      {/* Figma は不透明度55%の帯にグラデーションマスクを重ねる二層構成だが、
          bg-gradient-to-t の一層で同じ到達濃度 (下端55%) を再現できる */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-gray-800/55 to-transparent" />
      {/* line-clamp と padding を同じ要素に置くと overflow:hidden がパディングボックスで切り、
          はみ出た行がカード下端の余白に描画される。padding は親 (Link) 側に持たせる */}
      <h4 className="relative line-clamp-2 text-gray-50">{title}</h4>
    </Link>
  );
}
