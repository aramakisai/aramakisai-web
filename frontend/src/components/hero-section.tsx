/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { RichText } from './rich-text';

export interface HeroSectionProps {
  heroImageUrls: string[];
  heroMessageHtml: string;
}

export function HeroSection({
  heroImageUrls,
  heroMessageHtml,
}: HeroSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      {heroImageUrls.map((url) => (
        <img
          key={url}
          src={url}
          alt="ヒーロー画像"
          className="w-full h-[300px] object-cover shadow-sm"
        />
      ))}
      <RichText html={heroMessageHtml} className="hero-message" />
    </section>
  );
}
