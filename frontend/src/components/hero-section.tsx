/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { RichText } from './rich-text';
import { SandboxedEmbed } from './sandboxed-embed';

export interface HeroSectionProps {
  heroImageUrl: string | null;
  heroMessageHtml: string;
  embedUrl: string | null;
}

export function HeroSection({
  heroImageUrl,
  heroMessageHtml,
  embedUrl,
}: HeroSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      {heroImageUrl && (
        <img
          src={heroImageUrl}
          alt="ヒーロー画像"
          className="w-full h-auto object-cover"
        />
      )}
      <RichText html={heroMessageHtml} className="hero-message" />
      <SandboxedEmbed
        url={embedUrl}
        title="埋め込みコンテンツ"
        className="w-full aspect-video"
      />
    </section>
  );
}
