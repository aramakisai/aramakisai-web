/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { getFestivalMeta } from '@/lib/festival-meta';
import { toAssetUrl } from '@/lib/directus-asset-url';
import { FestivalOverview } from '@/components/festival-overview';
import { FestivalSummary } from '@/components/festival-summary';

export default async function AboutPage() {
  try {
    const meta = await getFestivalMeta();

    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">{meta.name || 'About'}</h1>

        {meta.heroImageId && (
          <div className="mb-8">
            <img
              src={toAssetUrl(meta.heroImageId) as string}
              alt={meta.name ? `${meta.name} hero` : 'hero'}
              className="w-full h-auto rounded-xl shadow-md object-cover"
            />
          </div>
        )}

        <div className="space-y-6">
          <FestivalOverview festival={meta} />
          <FestivalSummary overviewHtml={meta.overviewHtml} />
        </div>
      </main>
    );
  } catch {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">About</h1>
      </main>
    );
  }
}
