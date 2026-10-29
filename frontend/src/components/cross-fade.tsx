'use client';

import { useState, type ReactNode } from 'react';

interface Layer {
  readonly key: string;
  readonly node: ReactNode;
}

interface CrossFadeProps {
  readonly transitionKey: string;
  readonly children: ReactNode;
  /** false なら旧レイヤーを残さず即時に切り替える */
  readonly enabled?: boolean;
  readonly className?: string;
  /** 新レイヤーの下に旧が透けないよう、下地と同じ色の背景クラスを渡す */
  readonly layerClassName?: string;
  /** 下地が透明なとき、旧レイヤーを新の fade-in と同時に fade-out させて重なりを消す */
  readonly fadePrevious?: boolean;
}

/**
 * key が変わると旧 children を残したまま新 children を上に重ね、新側の fade-in 完了で旧を外す。
 * 旧を即時に消すと新が透明な間に下地だけが見えてちらつくため。
 */
export function CrossFade({
  transitionKey,
  children,
  enabled = true,
  className = '',
  layerClassName = '',
  fadePrevious = false,
}: CrossFadeProps) {
  // 旧レイヤーは切替時点の children を保持するため、フェード中は props の更新が反映されない
  const [current, setCurrent] = useState<Layer>({
    key: transitionKey,
    node: children,
  });
  const [previous, setPrevious] = useState<Layer | null>(null);

  if (current.key !== transitionKey) {
    setPrevious(enabled ? current : null);
    setCurrent({ key: transitionKey, node: children });
  }

  const base = `h-full w-full [grid-area:1/1] ${layerClassName}`;
  const layer = `${base} ${enabled ? 'fade-in' : ''}`;

  return (
    <div className={`grid ${className}`}>
      {previous && (
        <div
          key={previous.key}
          className={fadePrevious ? `${base} fade-out` : layer}
        >
          {previous.node}
        </div>
      )}
      <div
        key={transitionKey}
        className={layer}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setPrevious(null);
        }}
      >
        {children}
      </div>
    </div>
  );
}
