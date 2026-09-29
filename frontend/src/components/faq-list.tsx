import type { FaqEntry } from '@/lib/faq';
import { ExpandMoreIcon } from './icons';

export interface FaqListProps {
  readonly items: readonly Pick<FaqEntry, 'id' | 'question' | 'answer'>[];
}

const Divider = () => (
  <div aria-hidden="true" className="h-px w-full bg-gray-200" />
);

export function FaqList({ items }: FaqListProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div>
      <Divider />
      {items.map((item) => (
        <FaqAccordionItem
          key={item.id}
          question={item.question}
          answer={item.answer}
        />
      ))}
    </div>
  );
}

function FaqAccordionItem({
  question,
  answer,
}: Pick<FaqEntry, 'question' | 'answer'>) {
  return (
    <>
      {/*
       * name 属性は付けない。details に name を付けると同じ name を持つ他の details と
       * 排他開閉になり複数同時に開けなくなる。
       * ::details-content は details 自身の疑似要素で、group-open: (.group の子孫向け)
       * では効かないため open:details-content: を使う。
       */}
      <details className="group [interpolate-size:allow-keywords] details-content:h-0 details-content:overflow-hidden details-content:transition-[height,content-visibility] details-content:duration-200 details-content:ease-out details-content:transition-discrete open:details-content:h-auto motion-reduce:details-content:transition-none">
        <summary className="flex cursor-pointer list-none items-start gap-4 py-5 [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span className="flex-1 text-[16px] leading-[1.4] font-extrabold tracking-[0.02em] text-text">
            {question}
          </span>
          <ExpandMoreIcon className="shrink-0 text-gray-600 transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="pr-10 pb-6">
          {/* 罫線2px+内側14pxで文字の開始位置が質問と同じ16pxになる */}
          <p className="border-l-2 border-success whitespace-pre-line pl-[14px] text-[16px] leading-[1.8] tracking-[0.02em] text-text">
            {answer}
          </p>
        </div>
      </details>
      <Divider />
    </>
  );
}
