import { useEffect, useState } from 'react';
import { CANVAS_SIZE, type SignageOrientation } from './signage';

interface Size {
  readonly width: number;
  readonly height: number;
}

export interface CanvasFit {
  readonly scale: number;
  readonly left: number;
  readonly top: number;
}

export function fitCanvas(viewport: Size, canvas: Size): CanvasFit {
  const scale = Math.min(
    viewport.width / canvas.width,
    viewport.height / canvas.height,
  );
  return {
    scale,
    left: (viewport.width - canvas.width * scale) / 2,
    top: (viewport.height - canvas.height * scale) / 2,
  };
}

const PORTRAIT_QUERY = '(orientation: portrait)';

/** 初回は横型、マウント後に確定する(SSRとのhydration不一致を避ける) */
export function useOrientation(): SignageOrientation {
  const [orientation, setOrientation] =
    useState<SignageOrientation>('landscape');
  useEffect(() => {
    const mql = window.matchMedia(PORTRAIT_QUERY);
    const update = () => setOrientation(mql.matches ? 'portrait' : 'landscape');
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return orientation;
}

export function useCanvasFit(orientation: SignageOrientation): CanvasFit {
  const [fit, setFit] = useState<CanvasFit>({ scale: 1, left: 0, top: 0 });
  useEffect(() => {
    const update = () =>
      setFit(
        fitCanvas(
          { width: window.innerWidth, height: window.innerHeight },
          CANVAS_SIZE[orientation],
        ),
      );
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [orientation]);
  return fit;
}
