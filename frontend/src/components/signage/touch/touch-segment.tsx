'use client';

import {
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { MaterialIcon } from '@/components/icons';

export type TouchSegmentSize = 'nav' | 'page';

// 楕円の内側の余白 8 を引いた、選択中の背景の高さ
const BG_HEIGHT: Record<TouchSegmentSize, number> = { nav: 88, page: 56 };

type TouchButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> & {
  readonly icon?: string;
  readonly label?: string;
  readonly buttonRef?: Ref<HTMLButtonElement>;
};

/** 楕円の中に並ぶボタン。label が無ければ 56 角のアイコンだけのボタン(構内マップの拡大・縮小) */
export function TouchButton({
  icon,
  label,
  buttonRef,
  className = '',
  ...rest
}: TouchButtonProps) {
  const layout = !label
    ? 'size-14 p-px'
    : icon
      ? 'flex-col gap-[2px] px-5 py-1'
      : 'h-14 px-5 py-2';
  return (
    <button
      type="button"
      ref={buttonRef}
      className={`relative flex shrink-0 items-center justify-center whitespace-nowrap font-display leading-none tracking-normal text-text ${layout} ${className}`}
      {...rest}
    >
      {icon && <MaterialIcon name={icon} sizeClassName="text-[54px]!" />}
      {label && <span className="text-[24px] font-bold">{label}</span>}
    </button>
  );
}

export type TouchSegmentItem = {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  /** 選択中の背景色の Tailwind クラス(`bg-info` など)。行き先ごと・ページごとに呼び出し側が渡す */
  readonly color: string;
};

type Props = {
  readonly size: TouchSegmentSize;
  readonly items: readonly TouchSegmentItem[];
  /** 選択中の value。無ければ null(背景は透明) */
  readonly value: string | null;
  readonly onSelect: (value: string) => void;
  /** ボタンの前に置く見出し(「カテゴリ」など)。選択状態を持たない */
  readonly leading?: ReactNode;
  /** 選択状態を持たないボタン(「サイネージに戻る」・拡大縮小)を同じ楕円の末尾に並べる */
  readonly trailing?: ReactNode;
};

type Placement = { x: number; w: number; color: string };

export function TouchSegment({
  size,
  items,
  value,
  onSelect,
  leading,
  trailing,
}: Props) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [fontsReady, setFontsReady] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  // 直前に選択があったときだけ滑らせる。無い状態からの最初の選択は不透明度だけ変える
  const [slide, setSlide] = useState(false);
  const prevValue = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    // ラベルの幅はフォント読み込み後に確定する
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (live) setFontsReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!fontsReady) return;
    const el = value === null ? null : buttons.current.get(value);
    const item = items.find((i) => i.value === value);
    setSlide(prevValue.current !== null && value !== null);
    prevValue.current = value;
    if (el && item) {
      setPlacement({ x: el.offsetLeft, w: el.offsetWidth, color: item.color });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items は毎回新しい配列で渡されるため value と fontsReady だけで測る
  }, [value, fontsReady]);

  const visible = value !== null && placement !== null;
  return (
    <div
      className={`relative flex items-center gap-1 overflow-clip rounded-full bg-white p-2 shadow-card`}
    >
      <span
        aria-hidden="true"
        data-testid="touch-segment-bg"
        className={`pointer-events-none absolute left-0 top-2 rounded-full ${placement?.color ?? ''}`}
        style={{
          height: BG_HEIGHT[size],
          width: placement?.w ?? 0,
          transform: `translateX(${placement?.x ?? 0}px)`,
          opacity: visible ? 1 : 0,
          transitionProperty: slide
            ? 'transform, width, background-color, opacity'
            : 'opacity',
          transitionDuration: '200ms',
          transitionTimingFunction: 'ease-out',
        }}
      />
      {leading}
      {items.map((item) => (
        <TouchButton
          key={item.value}
          icon={item.icon}
          label={item.label}
          aria-pressed={item.value === value}
          buttonRef={(el) => {
            if (el) buttons.current.set(item.value, el);
            else buttons.current.delete(item.value);
          }}
          onClick={() => onSelect(item.value)}
        />
      ))}
      {trailing}
    </div>
  );
}
