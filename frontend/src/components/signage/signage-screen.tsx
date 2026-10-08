'use client';

import { nextDepartures } from '@/lib/bus-departures';
import { BUS_TIMETABLE } from '@/lib/bus-timetable-data';
import {
  buildPlaylist,
  CANVAS_SIZE,
  stageNow,
  type SignageSnapshot,
} from '@/lib/signage';
import { useCanvasFit, useOrientation } from '@/lib/signage-viewport';
import { useNow } from '@/lib/use-now';
import { usePolling } from '@/lib/use-polling';
import { useSlideRotation } from '@/lib/use-slide-rotation';
import { SignageBusInfo } from './signage-bus-info';
import { SignageLeftColumn } from './signage-left-column';
import { SignageMain } from './signage-main';
import { SignagePortraitHeader } from './signage-portrait-header';
import { SignagePortraitInfo } from './signage-portrait-info';
import { SignageTelop } from './signage-telop';
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
  const eventDays = data?.eventDays ?? [];
  const rows = data ? stageNow(data.timetable, now) : [];
  const boards = nextDepartures(
    BUS_TIMETABLE,
    now,
    orientation === 'portrait' ? 2 : 1,
  );

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
        <div className="absolute top-6 left-6 portrait:hidden">
          <SignageLeftColumn now={now} eventDays={eventDays} rows={rows} />
        </div>
        <div className="absolute top-6 left-6 hidden portrait:block">
          <SignagePortraitHeader now={now} eventDays={eventDays} />
        </div>
        <div className="absolute top-[829px] left-6 hidden portrait:block">
          <SignagePortraitInfo rows={rows} />
        </div>
        <div className="absolute top-[912px] left-[360px] portrait:top-[1776px] portrait:left-6">
          <SignageTelop items={data?.telops ?? []} />
        </div>
        <div className="absolute top-[912px] left-[1200px] portrait:top-[1389px] portrait:left-6">
          <SignageBusInfo boards={boards} />
        </div>
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
