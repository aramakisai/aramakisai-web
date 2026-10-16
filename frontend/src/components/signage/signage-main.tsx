import type { ComponentType } from 'react';
import { CrossFade } from '../cross-fade';
import type {
  PlaylistEntry,
  SignageSlide,
  SignageSnapshot,
} from '@/lib/signage';

export interface SlideRenderProps {
  readonly entry: PlaylistEntry;
  readonly snapshot: SignageSnapshot;
  readonly now: Date;
}

/** 種別ごとのスライド部品。未登録の種別は空の地のまま出す */
export type SlideRenderers = {
  readonly [K in SignageSlide['kind']]?: ComponentType<SlideRenderProps>;
};

interface SignageMainProps {
  readonly entry: PlaylistEntry | null;
  readonly snapshot: SignageSnapshot | null;
  readonly now: Date;
  readonly renderers: SlideRenderers;
  /** 緊急地震速報は即時に切り替えるため false で止める */
  readonly transition?: boolean;
}

export function SignageMain({
  entry,
  snapshot,
  now,
  renderers,
  transition = true,
}: SignageMainProps) {
  const Slide = entry ? renderers[entry.slide.kind] : undefined;
  return (
    <div className="signage-main-frame">
      <div className="signage-main">
        {entry && snapshot && Slide ? (
          <CrossFade
            transitionKey={entry.key}
            enabled={transition}
            className="h-full w-full"
            layerClassName="bg-white"
          >
            <Slide entry={entry} snapshot={snapshot} now={now} />
          </CrossFade>
        ) : null}
      </div>
    </div>
  );
}
