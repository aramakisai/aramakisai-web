'use client';

import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { MaterialIcon } from '@/components/icons';
import {
  DESTINATIONS,
  PRIMARY_NAV_DESTINATIONS,
  THEME_COLORS,
  type SignageNavDestination,
} from '@/components/primary-nav-card';
import { env } from '@/env';
import type { DirectionBoard } from '@/lib/bus-departures';
import type { EventDay } from '@/lib/home-page-types';
import type { SignageTelopItem, StageNowRow } from '@/lib/signage';
import {
  MAP_READY_TIMEOUT_MS,
  TOUCH_DESTINATIONS,
  type TouchDestination,
} from '@/lib/signage-touch';
import { buildTouchQrUrl } from '@/lib/signage-touch-qr';
import { isTouchMessage, type TouchFilters } from '@/lib/signage-touch-message';
import { SignageBusInfo } from './signage-bus-info';
import { SignageClock } from './signage-clock';
import {
  formatPerformanceRange,
  SignageDayDate,
  SignageIcon,
  SignageLogo,
  SignageOfficialSite,
  SignageStageChip,
} from './signage-parts';
import { SignageTelop } from './signage-telop';
import { TouchButton, TouchSegment } from './touch/touch-segment';
import type { TouchSession } from './use-touch-session';

// 生成前に待機中の QR を一瞬でも出さないための空画像
const BLANK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E';

// 色は一般向けサイトのヘッダーの現在地下線 (lib/navigation.ts)。駐車場はヘッダーに無いので下部ナビと同じ accent
const NAV: Record<
  TouchDestination,
  { readonly icon: string; readonly color: string }
> = {
  map: { icon: 'map', color: 'bg-secondary' },
  exhibitions: { icon: 'festival', color: 'bg-primary' },
  timetable: { icon: 'calendar_clock', color: 'bg-info' },
  parking: { icon: 'parking_sign', color: 'bg-accent' },
  topics: { icon: 'newspaper', color: 'bg-warning' },
};

const TOP_NAV_DESTINATIONS: readonly SignageNavDestination[] = [
  ...PRIMARY_NAV_DESTINATIONS,
  'topics',
];

// トップは選択状態にならない(トップ表示中はナビごと出さない)ので色は使われない
const HOME_VALUE = 'home';

const NAV_ITEMS = [
  { value: HOME_VALUE, label: 'トップ', icon: 'home', color: 'bg-gray-200' },
  ...TOUCH_DESTINATIONS.map((d) => ({
    value: d.key,
    label: d.label,
    ...NAV[d.key],
  })),
];

export interface SignageTouchLayerProps {
  readonly session: TouchSession;
  readonly now: Date;
  readonly eventDays: readonly EventDay[];
  readonly rows: readonly StageNowRow[] | null;
  readonly boards: readonly DirectionBoard[];
  readonly telops: readonly SignageTelopItem[];
  readonly offsetMs: number | null;
}

interface TouchLocation {
  readonly path: string | null;
  readonly filters: {
    readonly path: string;
    readonly value: TouchFilters;
  } | null;
}

/** iframe から届く表示中のパスと絞り込みを受ける。別オリジン・別 window からの知らせは捨てる */
function useTouchLocation(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  onReady: (path: string) => void,
) {
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });
  const [location, setLocation] = useState<TouchLocation>({
    path: null,
    filters: null,
  });
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isTouchMessage(e.data)) return;
      const m = e.data;
      if (m.type === 'signage-touch-ready') {
        onReadyRef.current(m.path);
        return;
      }
      setLocation((prev) =>
        m.type === 'signage-touch-path'
          ? { ...prev, path: m.path }
          : { path: m.path, filters: { path: m.path, value: m.filters } },
      );
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [iframeRef]);
  return [location, setLocation] as const;
}

function useQrSrc(url: string) {
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: 'svg', margin: 0 }).then((svg) => {
      if (live) setSrc(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    });
    return () => {
      live = false;
    };
  }, [url]);
  return src;
}

/** 閉じている間は描画しない。開いている間の状態(読み込み中・iframe)は子に持たせ、閉じると破棄する */
export function SignageTouchLayer({
  session,
  ...data
}: SignageTouchLayerProps) {
  if (session.state.kind === 'closed') return null;
  return <OpenLayer session={session} {...data} />;
}

function OpenLayer({
  session,
  now,
  eventDays,
  rows,
  boards,
  telops,
  offsetMs,
}: SignageTouchLayerProps) {
  const { state } = session;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // 幕が不透明になる前に遷移を始めると、旧ページが半透明の幕越しに消えてちらつくので、
  // in(fade-in 中) → covered(遷移・読み込み中) → out(fade-out 中) の順に進める
  const [curtain, setCurtain] = useState<{
    readonly dest: TouchDestination;
    readonly phase: 'in' | 'covered' | 'out';
    /** covered 中に iframe の load が済んだ */
    readonly loaded?: boolean;
    /** 行き先の地図の描画完了の知らせが届いた */
    readonly ready?: boolean;
  } | null>(null);
  // 待機画面の上に重ねて出す間だけ fade-in を付ける
  const [opening, setOpening] = useState(true);
  // トップへ戻るフェード中だけ、旧 iframe を残してボタン列を上に重ねる
  const [leaving, setLeaving] = useState(false);
  const [location, setLocation] = useTouchLocation(iframeRef, (path) =>
    setCurtain((c) =>
      c && TOUCH_DESTINATIONS.find((d) => d.key === c.dest)?.path === path
        ? { ...c, ready: true }
        : c,
    ),
  );
  const qrPath = location.path;
  const qrFilters =
    location.filters && location.filters.path === qrPath
      ? location.filters.value
      : undefined;
  const qrSrc = useQrSrc(
    buildTouchQrUrl(env.NEXT_PUBLIC_SITE_URL, qrPath, qrFilters),
  );
  const closing = state.kind === 'closing';
  // closing の状態は行き先を持たないが、フェード中は表示を残す
  const lastDestination = useRef<TouchDestination | null>(null);
  // トップへ戻るフェード中は destination が null でも旧 iframe の行き先を残す
  const frameDestination = useRef<TouchDestination | null>(null);
  if (state.kind === 'open' || state.kind === 'quakeHeld') {
    lastDestination.current = state.destination;
    if (state.destination) frameDestination.current = state.destination;
  }
  const destination = lastDestination.current;
  const current = TOUCH_DESTINATIONS.find((d) => d.key === destination);
  const frame = TOUCH_DESTINATIONS.find(
    (d) => d.key === frameDestination.current,
  );

  // 地図は load の時点でタイルが未描画なので、描画完了の知らせか上限時間まで幕を残す
  const needsReady = curtain?.dest === 'map';
  const loaded = curtain?.phase === 'covered' && !!curtain.loaded;
  const uncover = loaded && (!needsReady || !!curtain?.ready);
  useEffect(() => {
    if (uncover) setCurtain((c) => c && { ...c, phase: 'out' });
  }, [uncover]);
  const waitingReady = loaded && needsReady;
  useEffect(() => {
    if (!waitingReady) return;
    const id = setTimeout(
      () => setCurtain((c) => c && { ...c, phase: 'out' }),
      MAP_READY_TIMEOUT_MS,
    );
    return () => clearTimeout(id);
  }, [waitingReady]);

  const navigate = (dest: (typeof TOUCH_DESTINATIONS)[number]) => {
    iframeRef.current?.contentWindow?.location.replace(dest.path);
    session.select(dest.key);
  };

  const select = (key: string) => {
    if (key === HOME_VALUE) {
      setCurtain(null);
      setLocation({ path: null, filters: null });
      session.attachIframe(null);
      session.select(null);
      setLeaving(true);
      return;
    }
    if (key === destination && curtain === null) return;
    const dest = TOUCH_DESTINATIONS.find((d) => d.key === key)!;
    if (curtain?.dest === dest.key) return;
    // 新しいページの知らせが届くまで、QR は選んだ行き先のトップを指す
    setLocation({ path: dest.path, filters: null });
    if (curtain?.phase === 'covered') navigate(dest);
    setCurtain({
      dest: dest.key,
      phase: curtain?.phase === 'covered' ? 'covered' : 'in',
    });
  };

  const onCurtainEnd = (e: React.AnimationEvent) => {
    if (e.target !== e.currentTarget || !curtain) return;
    if (curtain.phase === 'out') setCurtain(null);
    else if (curtain.phase === 'in') {
      navigate(TOUCH_DESTINATIONS.find((d) => d.key === curtain.dest)!);
      setCurtain({ dest: curtain.dest, phase: 'covered' });
    }
  };

  return (
    <div
      className={`absolute inset-0 bg-background ${closing ? 'fade-out pointer-events-none' : opening ? 'fade-in' : ''}`}
      onPointerDownCapture={session.activity}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (closing) session.fadeEnd();
        else setOpening(false);
      }}
    >
      {(current || leaving) && frame && (
        <TouchFrame
          key="frame"
          iframeRef={iframeRef}
          title={frame.label}
          initialSrc={frame.path}
          onLoad={(el) => {
            setCurtain((c) =>
              c?.phase === 'covered' ? { ...c, loaded: true } : c,
            );
            session.attachIframe(el);
          }}
        />
      )}
      {!current && (
        <div
          className={`absolute top-[352px] right-0 bottom-0 left-0 flex items-center justify-center gap-10 bg-background ${leaving ? 'fade-in' : ''}`}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setLeaving(false);
          }}
        >
          {TOP_NAV_DESTINATIONS.map((d) => (
            <TopNavButton key={d} destination={d} onSelect={select} />
          ))}
        </div>
      )}
      {curtain && !closing && (
        <div
          onAnimationEnd={onCurtainEnd}
          className={`absolute top-[352px] right-0 bottom-0 left-0 flex flex-col items-center justify-center gap-4 bg-background leading-none font-display ${curtain.phase === 'in' ? 'fade-in' : curtain.phase === 'out' ? 'fade-out' : ''}`}
        >
          <span
            data-testid="touch-loading-spinner"
            className="flex size-16 animate-spin items-center justify-center text-[64px] text-info"
          >
            <SignageIcon name="progress_activity" />
          </span>
          <span className="text-[28px] font-bold text-gray-600">
            読み込み中
          </span>
        </div>
      )}
      <div className="absolute top-0 right-0 left-0 h-[352px] bg-gray-200">
        <div className="absolute top-[30px] left-4 flex w-[312px] flex-col gap-6">
          <SignageLogo className="h-[55.42px] w-full" />
          <SignageDayDate
            eventDays={eventDays}
            now={now}
            baseClass="bg-gray-200"
          />
        </div>
        <div className="absolute top-10 left-[352px]">
          <SignageClock now={now} />
        </div>
        {rows && (
          <div className="absolute top-4 left-[660px] flex w-[880px] flex-col gap-4">
            <div className="flex items-center gap-2 font-display text-[28px] leading-none font-bold text-text">
              <SignageIcon name="mic" />
              <span>いまのステージ</span>
            </div>
            <div className="flex gap-6">
              {rows.map(({ stage, colorIndex, performance }) => (
                <div
                  key={stage.id}
                  className="flex w-[277.33px] shrink-0 flex-col items-start gap-1"
                >
                  <SignageStageChip colorIndex={colorIndex} name={stage.name} />
                  {performance ? (
                    <>
                      <p className="line-clamp-2 w-full text-[28px] leading-[1.25] font-bold text-text">
                        {performance.name}
                      </p>
                      <p className="text-[24px] leading-[1.25] whitespace-nowrap text-gray-600">
                        {formatPerformanceRange(performance)}
                      </p>
                    </>
                  ) : (
                    <p className="text-signage-heading font-bold text-gray-600">
                      公演なし
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="absolute top-[192px] left-4">
          <SignageTelop
            items={telops}
            orientation="landscape"
            offsetMs={offsetMs}
          />
        </div>
        <div className="absolute top-[192px] left-[1012px]">
          <SignageBusInfo boards={boards} />
        </div>
        <div className="absolute top-[38px] left-[1564px] w-[340px]">
          <SignageOfficialSite
            labelClass="text-[28px]"
            qrClass="size-[240px]"
            label="▼この画面をスマホで見る"
            qrSrc={qrSrc ?? BLANK_IMAGE}
          />
        </div>
      </div>
      {current && (
        <div className="absolute top-[952px] right-6">
          <TouchSegment
            size="nav"
            items={NAV_ITEMS}
            value={curtain?.dest ?? destination}
            onSelect={select}
            trailing={
              <TouchButton
                icon="close"
                label="サイネージに戻る"
                onClick={session.back}
              />
            }
          />
        </div>
      )}
    </div>
  );
}

/** HP トップの PrimaryNavCard の 2 倍寸 */
function TopNavButton({
  destination,
  onSelect,
}: {
  readonly destination: SignageNavDestination;
  readonly onSelect: (key: string) => void;
}) {
  const { icon, label, color } = DESTINATIONS[destination];
  return (
    <button
      type="button"
      onClick={() => onSelect(destination)}
      // border-current とアイコンはこの色を継ぐ
      style={{ color: THEME_COLORS[color] }}
      className="flex size-80 flex-col items-center justify-center gap-4 rounded-3xl border-4 border-current bg-white p-10"
    >
      <MaterialIcon name={icon} sizeClassName="text-[144px]!" />
      <span className="text-[32px] leading-[1.5] font-bold whitespace-nowrap text-text">
        {label}
      </span>
    </button>
  );
}

function TouchFrame({
  iframeRef,
  title,
  initialSrc,
  onLoad,
}: {
  readonly iframeRef: React.RefObject<HTMLIFrameElement | null>;
  readonly title: string;
  readonly initialSrc: string;
  readonly onLoad: (el: HTMLIFrameElement) => void;
}) {
  // 以降の切替は location.replace で行うので、src 属性は最初の値のまま変えない
  const [src] = useState(initialSrc);
  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      onLoad={(e) => onLoad(e.currentTarget)}
      className="absolute top-[352px] right-0 bottom-0 left-0 h-[728px] w-full border-0"
    />
  );
}
