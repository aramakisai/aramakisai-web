import type { ExhibitionMenuItem } from '@/lib/exhibitions';

export interface ExhibitionMenuProps {
  readonly items: readonly ExhibitionMenuItem[];
}

export function ExhibitionMenu({ items }: ExhibitionMenuProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-[140%] text-gray-600">メニュー</p>
      <table className="w-[280px] max-w-full [&_tr+tr>td]:pt-1 text-sm leading-[140%] text-gray-600">
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="p-0 text-left">{item.name}</td>
              <td className="p-0 text-right tabular-nums">{item.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
