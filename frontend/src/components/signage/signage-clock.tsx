import { formatSignageClock } from '@/lib/signage-clock';

// Noto Sans JP Black 104px の数字 0〜9 は tnum 指定なしでも全て 63.3px で等幅だが、
// フォント読み込み前のフォールバック(system-ui 等)は比例幅になり得る。
// 数字ごとに固定幅の箱に入れ、桁が時刻で横にずれないようにする。
// 4 桁 + コロンが左カラム幅 312px に収まる 68px(0.65em)を箱幅にしている。
export function SignageClock({ now }: { readonly now: Date }) {
  return (
    <p className="font-display text-[104px] leading-none font-black whitespace-nowrap text-text">
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
