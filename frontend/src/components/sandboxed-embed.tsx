'use client';

import React, { useEffect, useState } from 'react';

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
  const [warm, setWarm] = useState(false);

  // 画面外でも iframe は window load を止めるため、load 後に src を与える
  useEffect(() => {
    if (document.readyState === 'complete') {
      setWarm(true);
      return;
    }
    const onLoad = () => setWarm(true);
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  if (!url) {
    return null;
  }

  return (
    <iframe
      src={warm ? url : undefined}
      title={title}
      className={className}
      style={style}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
