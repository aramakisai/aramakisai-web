import type { ComponentType } from 'react';
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
}

export function SignageMain({
  entry,
  snapshot,
  now,
  renderers,
}: SignageMainProps) {
  const Slide = entry ? renderers[entry.slide.kind] : undefined;
  return (
    <div className="signage-main-frame">
      <div className="signage-main">
        {entry && snapshot && Slide ? (
          <Slide entry={entry} snapshot={snapshot} now={now} />
        ) : null}
      </div>
    </div>
  );
}
