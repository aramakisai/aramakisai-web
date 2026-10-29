'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/icons';
import { parseExchangeUrl } from '@/lib/exchange-url';

type ScanState = 'scanning' | 'not_exchange' | 'unavailable';

const SCAN_INTERVAL_MS = 250;

function StatusRow({
  align,
  children,
}: {
  readonly align: 'items-center' | 'items-start';
  readonly children: string;
}) {
  return (
    <p className={`flex gap-1 text-sm leading-[1.4] text-text ${align}`}>
      <MaterialIcon name="sync_problem" size={16} className="text-warning" />
      {children}
    </p>
  );
}

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>('scanning');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stream: MediaStream | undefined;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
        // wasm は既定で CDN から取るため、自サイト配信に差し替える
        const { BarcodeDetector, prepareZXingModule } =
          await import('barcode-detector/ponyfill');
        prepareZXingModule({
          overrides: {
            locateFile: (path: string, prefix: string) =>
              path.endsWith('.wasm') ? `/vendor/zxing/${path}` : prefix + path,
          },
        });
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        let busy = false;
        timer = setInterval(async () => {
          if (busy) return;
          busy = true;
          try {
            const codes = await detector.detect(video);
            if (cancelled || codes.length === 0) return;
            const next = parseExchangeUrl(
              codes[0].rawValue,
              window.location.origin,
            );
            if (next) {
              cancelled = true;
              router.push(next);
            } else {
              setState('not_exchange');
            }
          } catch {
            // 1 フレームの検出失敗は次のフレームで取り直す
          } finally {
            busy = false;
          }
        }, SCAN_INTERVAL_MS);
      } catch {
        if (!cancelled) setState('unavailable');
      }
    }
    void start();

    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  if (state === 'unavailable') {
    return (
      <StatusRow align="items-start">
        カメラを使用できません。スマートフォンのカメラで交換用QRを読み取ってください
      </StatusRow>
    );
  }
  return (
    <>
      <div className="relative flex h-[358px] w-full items-center justify-center overflow-clip rounded-md bg-text">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative size-[220px] rounded-md border-2 border-background" />
      </div>
      <p className="text-base leading-[1.7] text-text">
        交換用QRを枠に合わせてください
      </p>
      {state === 'not_exchange' && (
        <StatusRow align="items-center">交換用QRではありません</StatusRow>
      )}
    </>
  );
}
