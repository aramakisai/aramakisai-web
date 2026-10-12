import { formatSignageClock } from '@/lib/signage-clock';

// LINE Seed JP は tnum 非対応で、数字幅が 1 の 53px〜0 の 79px とばらつく。
// 数字ごとに固定幅の箱に入れ、桁が時刻で横にずれないようにする。
// 4 桁 + コロンが左カラム幅 312px に収まる 68px(0.65em)を箱幅にしている。
export function SignageClock({ now }: { readonly now: Date }) {
  return (
    <p className="font-display text-[104px] leading-none font-extrabold whitespace-nowrap text-text">
      {[...formatSignageClock(now)].map((ch, i) =>
        ch === ':' ? (
          <span key={i}>{ch}</span>
        ) : (
          <span key={i} className="inline-flex w-[0.65em] justify-center">
            {ch}
          </span>
        ),
      )}
    </p>
  );
}
