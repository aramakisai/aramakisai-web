'use client';

import { useEffect, useRef, useState } from 'react';
import { nextDepartures } from '@/lib/bus-departures';
import { BUS_TIMETABLE } from '@/lib/bus-timetable-data';
import {
  buildPlaylist,
  CANVAS_SIZE,
  slideAt,
  stageNow,
  type SignageSnapshot,
} from '@/lib/signage';
import { clockOffsetMs, useCorrectedNow } from '@/lib/signage-time';
import { useCanvasLayout } from '@/lib/signage-viewport';
import { usePolling } from '@/lib/use-polling';
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

interface Polled {
  readonly snapshot: SignageSnapshot;
  /** 取得に成功するたびに更新する端末時計のずれ。初期スナップショットでは未計測 */
  readonly offsetMs: number | null;
}

async function fetchSnapshot(): Promise<Polled> {
  const sentAt = Date.now();
  const res = await fetch('/api/signage', { cache: 'no-store' });
  const receivedAt = Date.now();
  if (!res.ok) throw new Error(`signage ${res.status}`);
  const snapshot = (await res.json()) as SignageSnapshot;
  return {
    snapshot,
    offsetMs: clockOffsetMs(snapshot.serverNow, sentAt, receivedAt),
  };
}

export function SignageScreen({ initial, renderedAt }: SignageScreenProps) {
  const { data: polled } = usePolling<Polled>({
    fetcher: fetchSnapshot,
    intervalMs: POLL_INTERVAL_MS,
    immediate: true,
    initial: initial && { snapshot: initial, offsetMs: null },
  });
  const data = polled?.snapshot ?? null;
  const serverIso = initial?.serverNow ?? renderedAt;
  // マウント直後の最初の取得が終わるまでは SSR 時のサーバー時刻を基準にする (配送遅延ぶん遅れる)
  const [mountOffsetMs, setMountOffsetMs] = useState<number | null>(null);
  useEffect(() => {
    setMountOffsetMs(Date.parse(serverIso) - Date.now());
  }, [serverIso]);
  const offsetMs = polled?.offsetMs ?? mountOffsetMs;
  const now = useCorrectedNow(offsetMs, serverIso);
  const rootRef = useRef<HTMLDivElement>(null);
  const layout = useCanvasLayout(rootRef);
  const orientation = layout?.orientation ?? 'landscape';
  const fit = layout?.fit ?? { scale: 1, left: 0, top: 0 };
  const entries = data ? buildPlaylist(data, now) : [];
  const entry = slideAt(entries, now.getTime())?.entry ?? null;
  const canvas = CANVAS_SIZE[orientation];
  const eventDays = data?.eventDays ?? [];
  const rows = data ? stageNow(data.timetable, now) : null;
  const boards = nextDepartures(
    BUS_TIMETABLE,
    now,
    orientation === 'portrait' ? 2 : 1,
  );

  return (
    <div ref={rootRef} className="fixed inset-0 overflow-hidden bg-background">
      <div
        data-orientation={orientation}
        className="signage-canvas absolute origin-top-left"
        style={{
          visibility: layout ? 'visible' : 'hidden',
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
          <SignageTelop
            items={data?.telops ?? []}
            orientation={orientation}
            offsetMs={offsetMs}
          />
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
