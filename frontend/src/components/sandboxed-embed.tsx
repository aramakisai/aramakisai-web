import React from 'react';

export interface SandboxedEmbedProps {
  url: string | null | undefined;
  title: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SandboxedEmbed({
  url,
  title,
  className,
  style,
}: SandboxedEmbedProps) {
  if (!url) {
    return null;
  }

  return (
    <iframe
      src={url}
      title={title}
      className={className}
      style={style}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
