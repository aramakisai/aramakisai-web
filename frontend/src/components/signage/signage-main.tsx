'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { CrossFade } from '../cross-fade';
import type {
  PlaylistEntry,
  SignageSlide,
  SignageSnapshot,
} from '@/lib/signage';
import type { StageStartNotice } from '@/lib/signage-stage-notice';
import { NOTICE_MOTION } from '@/lib/signage-stage-notice-shapes';
import { SignageStageNotice } from './signage-stage-notice';

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
  readonly notices?: readonly StageStartNotice[];
}

interface Held {
  readonly notices: readonly StageStartNotice[];
  readonly ids: string;
  readonly leaving: boolean;
  /** 退場中に告知が戻ったときに層を入場から出し直すための key */
  readonly gen: number;
}

const NO_NOTICES: readonly StageStartNotice[] = [];

export function SignageMain({
  entry,
  snapshot,
  now,
  renderers,
  transition = true,
  notices = NO_NOTICES,
}: SignageMainProps) {
  const [held, setHeld] = useState<Held | null>(null);
  // notices は親が毎秒新しい配列で渡すため、中身ではなく ID の並びで変化を見る
  const ids = notices.map((n) => n.performanceId).join(',');
  if (notices.length > 0) {
    if (!held || held.leaving) {
      setHeld({ notices, ids, leaving: false, gen: (held?.gen ?? 0) + 1 });
    } else if (held.ids !== ids) {
      setHeld({ ...held, notices, ids });
    }
  } else if (held && !held.leaving) {
    setHeld({ ...held, leaving: true });
  }
  const leaving = held?.leaving ?? false;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setHeld(null), NOTICE_MOTION.leave.totalMs);
    return () => clearTimeout(timer);
  }, [leaving]);

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
        {held ? (
          <SignageStageNotice
            key={held.gen}
            notices={notices.length > 0 ? notices : held.notices}
            now={now}
            leaving={held.leaving}
          />
        ) : null}
      </div>
    </div>
  );
}
