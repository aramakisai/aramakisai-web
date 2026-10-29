'use client';

import { useEffect, useRef, useState } from 'react';
import { nextDepartures } from '@/lib/bus-departures';
import { BUS_TIMETABLE } from '@/lib/bus-timetable-data';
import {
  buildPlaylist,
  CANVAS_SIZE,
  pinnedEntries,
  slideAt,
  stageNow,
  type SignageSnapshot,
} from '@/lib/signage';
import { withPin } from '@/lib/signage-pin';
import { parseQuakePayload } from '@/lib/signage-quake';
import { noticeTelops, stageStartNotices } from '@/lib/signage-stage-notice';
import { clockOffsetMs, useCorrectedNow } from '@/lib/signage-time';
import { useCanvasLayout } from '@/lib/signage-viewport';
import {
  useSignageChannel,
  useSignageFeature,
} from '@/lib/use-signage-channel';
import { usePolling } from '@/lib/use-polling';
import { SignageBubbles } from './signage-bubbles';
import { SignageBusInfo } from './signage-bus-info';
import { SignageLeftColumn } from './signage-left-column';
import { SignageMain } from './signage-main';
import { SignagePortraitHeader } from './signage-portrait-header';
import { SignagePortraitInfo } from './signage-portrait-info';
import { SignageQuakeOverlay } from './signage-quake-overlay';
import { SignageTelop } from './signage-telop';
import { SignageTouchLayer } from './signage-touch-layer';
import { useTouchSession } from './use-touch-session';
import { SLIDE_RENDERERS } from './slide-renderers';

export interface SignageScreenProps {
  readonly initial: SignageSnapshot | null;
  readonly renderedAt: string;
}

// 通知が届かなかったときの保険。通常の反映は配信経路の版の知らせで行う
const POLL_INTERVAL_MS = 120_000;
// 全端末が同じ版の知らせを同時に受けるので、取得を散らして共有キャッシュの初回取得を1回に近づける
const REFETCH_JITTER_MS = 1_000;

interface Polled {
  readonly snapshot: SignageSnapshot;
  /** 取得に成功するたびに更新する端末時計のずれ。初期スナップショットでは未計測 */
  readonly offsetMs: number | null;
}

async function fetchSnapshotFrom(url: string): Promise<Polled> {
  const sentAt = Date.now();
  const res = await fetch(url, { cache: 'no-store' });
  const receivedAt = Date.now();
  if (!res.ok) throw new Error(`signage ${res.status}`);
  const snapshot = (await res.json()) as SignageSnapshot;
  return {
    snapshot,
    offsetMs: clockOffsetMs(snapshot.serverNow, sentAt, receivedAt),
  };
}

export function SignageScreen({ initial, renderedAt }: SignageScreenProps) {
  const handledVersion = useRef<number | undefined>(undefined);
  const { data: polled, refresh } = usePolling<Polled>({
    // 版なしの通常キーは TTL 最大60秒の古い内容を返し得るので、版を受けた後は版付きで取る
    fetcher: () =>
      fetchSnapshotFrom(
        handledVersion.current === undefined
          ? '/api/signage'
          : `/api/signage?v=${handledVersion.current}`,
      ),
    intervalMs: POLL_INTERVAL_MS,
    immediate: true,
    initial: initial && { snapshot: initial, offsetMs: null },
  });
  const channel = useSignageChannel();
  const snapshot = polled?.snapshot ?? null;
  const data = snapshot && withPin(snapshot, channel.pin);
  const { snapshotVersion } = channel;
  useEffect(() => {
    if (
      snapshotVersion === undefined ||
      snapshotVersion === handledVersion.current
    )
      return;
    const timer = setTimeout(() => {
      void refresh(async () => {
        const result = await fetchSnapshotFrom(
          `/api/signage?v=${snapshotVersion}`,
        );
        handledVersion.current = snapshotVersion;
        return result;
      });
    }, Math.random() * REFETCH_JITTER_MS);
    return () => clearTimeout(timer);
  }, [snapshotVersion, refresh]);
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
  // 形が合わない payload は表示せず、通常の画面のままにする
  const quake = parseQuakePayload(useSignageFeature(channel, 'quake', now));
  const pinned = data !== null && pinnedEntries(data, now).length > 0;
  const session = useTouchSession({
    quakeActive: quake?.active ?? false,
    pinned,
  });
  const notices = data && !pinned ? stageStartNotices(data.timetable, now) : [];
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
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-hidden bg-background"
      onPointerDown={() => session.tap(orientation)}
    >
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
        <SignageBubbles orientation={orientation} />
        <div className="absolute top-6 left-6 portrait:hidden">
          <SignageLeftColumn now={now} eventDays={eventDays} rows={rows} />
        </div>
        <div className="absolute top-6 left-6 hidden portrait:block">
          <SignagePortraitHeader now={now} eventDays={eventDays} />
        </div>
        <div className="absolute top-[829px] left-6 hidden portrait:block">
          <SignagePortraitInfo rows={rows} now={now} />
        </div>
        <div className="absolute top-[912px] left-[360px] portrait:top-[1776px] portrait:left-6">
          <SignageTelop
            items={data?.telops ?? []}
            orientation={orientation}
            offsetMs={offsetMs}
          />
        </div>
        <div className="absolute top-[912px] left-[1368px] portrait:top-[1389px] portrait:left-6">
          <SignageBusInfo boards={boards} />
        </div>
        <SignageMain
          entry={entry}
          snapshot={data}
          now={now}
          renderers={SLIDE_RENDERERS}
          notices={notices}
        />
        <SignageTouchLayer
          session={session}
          now={now}
          eventDays={eventDays}
          rows={rows}
          boards={boards}
          telops={
            notices.length > 0 ? noticeTelops(notices) : (data?.telops ?? [])
          }
          offsetMs={offsetMs}
        />
        {quake?.active && (
          <SignageQuakeOverlay
            quake={quake}
            slide={data?.quakeSlides[quake.stage] ?? null}
            snapshot={data}
            now={now}
            renderers={SLIDE_RENDERERS}
          />
        )}
      </div>
    </div>
  );
}
