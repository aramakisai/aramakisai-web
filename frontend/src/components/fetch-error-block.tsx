import { MaterialIcon } from '@/components/icons';

export function FetchErrorBlock({
  message,
  onReload,
}: {
  readonly message: string;
  readonly onReload: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="flex items-center gap-1 text-sm leading-[1.4] text-text">
        <MaterialIcon name="sync_problem" size={16} className="text-warning" />
        {message}
      </p>
      <button
        type="button"
        onClick={onReload}
        className="rounded-md border border-gray-200 px-4 py-2 text-sm leading-[normal] text-text transition-[background-color,box-shadow] duration-200 ease-out hover:bg-background hover:shadow-card motion-reduce:transition-none"
      >
        再読み込み
      </button>
    </div>
  );
}
