'use client';

import { useState } from 'react';
import type { Dashboard } from '@/lib/stamp-aggregate';

const PLOT_HEIGHT = 160;
// 最下段の目盛り線 (1px) の上端。棒はこの線の手前で止める
const BASE_Y = 159;

const label = (d: Dashboard['distribution'][number]) =>
  `${d.stampCount}個 ${d.visitorCount}台`;

export function StampDistributionChart({
  distribution,
}: {
  readonly distribution: Dashboard['distribution'];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(0, ...distribution.map((d) => d.visitorCount));
  const ticks = [max, Math.round(max / 2), 0];
  const tickY = [0, 79, BASE_Y];
  const current = distribution.find((d) => d.stampCount === selected);
  const count = distribution.length;

  return (
    <div className="flex flex-col gap-2">
      {current && (
        <p className="text-sm leading-[1.6] text-text">{label(current)}</p>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-xs leading-[1.4] font-medium text-gray-600">
          端末数 (台)
        </p>
        <div className="relative" style={{ height: PLOT_HEIGHT }}>
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 w-7 text-xs leading-[1.4] font-medium text-gray-600"
          >
            {ticks.map((t, i) => (
              <p
                key={i}
                className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                style={{ top: tickY[i] + 0.5 }}
              >
                {t}
              </p>
            ))}
          </div>
          <div className="absolute top-0 right-2 bottom-0 left-7">
            {tickY.map((y) => (
              <div
                key={y}
                aria-hidden="true"
                className="absolute left-0 h-px w-full bg-gray-200"
                style={{ top: y }}
              />
            ))}
            <div
              className="absolute top-0 left-0 flex w-full gap-px"
              style={{ height: BASE_Y }}
            >
              {distribution.map((d) => (
                <button
                  key={d.stampCount}
                  type="button"
                  aria-label={label(d)}
                  aria-pressed={selected === d.stampCount}
                  onClick={() =>
                    setSelected(selected === d.stampCount ? null : d.stampCount)
                  }
                  className="flex h-full min-w-0 flex-1 items-end"
                >
                  <span
                    className={`block w-full ${selected === d.stampCount ? 'bg-primary' : 'bg-accent-alt'}`}
                    style={{
                      height: max === 0 ? 0 : (d.visitorCount / max) * BASE_Y,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="relative mr-2 ml-7 h-[17px] text-xs leading-[1.4] font-medium text-gray-600"
        >
          {distribution
            .filter((d) => d.stampCount === 1 || d.stampCount % 10 === 0)
            .map((d) => (
              <p
                key={d.stampCount}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${((d.stampCount - 0.5) / count) * 100}%` }}
              >
                {d.stampCount}
              </p>
            ))}
        </div>
        <p className="text-right text-xs leading-[1.4] font-medium text-gray-600">
          スタンプ数 (個)
        </p>
      </div>
    </div>
  );
}
