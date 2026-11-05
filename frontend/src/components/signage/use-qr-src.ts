import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

// 生成前に待機中の QR を一瞬でも出さないための空画像
export const BLANK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E';

export function useQrSrc(url: string) {
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
