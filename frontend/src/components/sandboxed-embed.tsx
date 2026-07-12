import React from 'react';

export interface SandboxedEmbedProps {
  url: string | null | undefined;
  title: string;
  className?: string;
}

export function SandboxedEmbed({ url, title, className }: SandboxedEmbedProps) {
  if (!url) {
    return null;
  }

  return (
    <iframe
      src={url}
      title={title}
      className={className}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
