import { SearchIcon } from './icons';

// 送信時に /exhibitions へ遷移するだけの入力で、トップページ内では絞り込まない
// (design.md Requirement 3)。ネイティブの GET フォームに任せることで、クエリの組み立てに
// JS を要さない。q の解釈 (trim・NFKC 等) は /exhibitions 側の parseExhibitionQuery が持つ。
export function ExhibitionSearchForm() {
  return (
    <form action="/exhibitions" method="get" role="search">
      <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-background px-4 py-3 focus-within:border-primary lg:w-[480px]">
        <SearchIcon size={20} className="text-text" />
        <span className="sr-only">企画を検索</span>
        <input
          type="search"
          name="q"
          placeholder="企画名・団体名で検索"
          className="w-full bg-transparent text-text outline-none placeholder:text-gray-400"
        />
      </label>
    </form>
  );
}
