import type { ExhibitionMenuItem } from '@/lib/exhibitions';

export interface ExhibitionMenuProps {
  readonly items: readonly ExhibitionMenuItem[];
  readonly variant?: 'site' | 'signage';
}

/** 桁区切りは付けない。サイト内の既存の価格表記 (1200円) に合わせる */
export function formatPrice(price: number): string {
  return `${price}円`;
}

export function ExhibitionMenu({
  items,
  variant = 'site',
}: ExhibitionMenuProps) {
  if (items.length === 0) {
    return null;
  }

  const text = variant === 'signage' ? 'text-signage-meta' : null;
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-gray-600 ${text ?? 'text-xs leading-[140%]'}`}>
        メニュー
      </p>
      <table
        className={`w-[280px] max-w-full text-gray-600 [&_tr+tr>td]:pt-1 ${text ?? 'text-sm leading-[140%]'}`}
      >
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="p-0 text-left">{item.name}</td>
              <td className="p-0 text-right tabular-nums">
                {formatPrice(item.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
