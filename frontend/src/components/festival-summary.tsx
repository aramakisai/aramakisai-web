import React from 'react';
import { RichText } from './rich-text';

export interface FestivalSummaryProps {
  overviewHtml: string | null;
}

export function FestivalSummary({ overviewHtml }: FestivalSummaryProps) {
  if (!overviewHtml) {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mt-4">
      <h2 className="text-sm font-semibold text-gray-500 mb-2">祭の概要</h2>
      <RichText html={overviewHtml} className="text-gray-800" />
    </section>
  );
}
