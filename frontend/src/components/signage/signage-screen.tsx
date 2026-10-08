'use client';

import {
  buildPlaylist,
  CANVAS_SIZE,
  type SignageSnapshot,
} from '@/lib/signage';
import { useCanvasFit, useOrientation } from '@/lib/signage-viewport';
import { useNow } from '@/lib/use-now';
import { usePolling } from '@/lib/use-polling';
import { useSlideRotation } from '@/lib/use-slide-rotation';
import { SignageMain } from './signage-main';
import { SLIDE_RENDERERS } from './slide-renderers';

export interface SignageScreenProps {
  readonly initial: SignageSnapshot | null;
  readonly renderedAt: string;
}

const POLL_INTERVAL_MS = 20_000;

async function fetchSnapshot(): Promise<SignageSnapshot> {
  const res = await fetch('/api/signage', { cache: 'no-store' });
  if (!res.ok) throw new Error(`signage ${res.status}`);
  return (await res.json()) as SignageSnapshot;
}

export function SignageScreen({ initial, renderedAt }: SignageScreenProps) {
  const { data } = usePolling<SignageSnapshot>({
    fetcher: fetchSnapshot,
    intervalMs: POLL_INTERVAL_MS,
    initial,
  });
  const now = useNow(renderedAt, 1000);
  const orientation = useOrientation();
  const fit = useCanvasFit(orientation);
  const entries = data ? buildPlaylist(data, now) : [];
  const entry = useSlideRotation(entries);
  const canvas = CANVAS_SIZE[orientation];

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div
        className="signage-canvas absolute origin-top-left"
        style={{
          width: canvas.width,
          height: canvas.height,
          left: fit.left,
          top: fit.top,
          transform: `scale(${fit.scale})`,
        }}
      >
        <SignageMain
          entry={entry}
          snapshot={data}
          now={now}
          renderers={SLIDE_RENDERERS}
        />
      </div>
    </div>
  );
}
