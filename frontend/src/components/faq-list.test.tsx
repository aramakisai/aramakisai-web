import { render, screen, within } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { FaqList } from './faq-list';

describe('FaqList', () => {
  const items = [
    { id: 1, question: '駐車場はありますか?', answer: '駐車場はありません。' },
    { id: 2, question: '入場は無料ですか?', answer: 'はい、無料です。' },
  ];

  test('CMSの表示順どおりにdetails要素として質問と回答を描画する', () => {
    const { container } = render(<FaqList items={items} />);

    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(2);

    const summary1 = within(details[0] as HTMLElement).getByText(
      '駐車場はありますか?',
    );
    expect(summary1.closest('summary')).not.toBeNull();
    expect(
      within(details[0] as HTMLElement).getByText('駐車場はありません。'),
    ).toBeInTheDocument();

    const summary2 = within(details[1] as HTMLElement).getByText(
      '入場は無料ですか?',
    );
    expect(summary2.closest('summary')).not.toBeNull();
    expect(
      within(details[1] as HTMLElement).getByText('はい、無料です。'),
    ).toBeInTheDocument();
  });

  test('区切り線を項目数+1本、先頭と各項目の下に配置する', () => {
    const { container } = render(<FaqList items={items} />);

    // 区切り線はdetailsの外に置く兄弟要素なので、直下の子を並び順どおりに調べる
    const children = Array.from(
      (container.firstElementChild as HTMLElement).children,
    );
    const tagSequence = children.map((el) => el.tagName);

    expect(tagSequence).toEqual(['DIV', 'DETAILS', 'DIV', 'DETAILS', 'DIV']);
    expect(children.filter((el) => el.tagName === 'DIV')).toHaveLength(3);
  });

  test('全項目が初期状態で閉じており、複数同時に開けるようopen・name属性を持たない', () => {
    const { container } = render(<FaqList items={items} />);

    for (const details of container.querySelectorAll('details')) {
      expect(details).not.toHaveAttribute('open');
      expect(details).not.toHaveAttribute('name');
    }
  });

  test('質問はsummary要素の中にあり行全体が押せる', () => {
    const { container } = render(<FaqList items={[items[0]]} />);

    const summary = container.querySelector('summary');
    expect(summary).not.toBeNull();
    expect(
      within(summary as HTMLElement).getByText('駐車場はありますか?'),
    ).toBeInTheDocument();
  });

  test('回答はHTMLとして解釈せず改行を保ったプレーンテキストとして描画する', () => {
    const answer = '1行目<strong>強調</strong>\n2行目';
    render(<FaqList items={[{ id: 1, question: 'Q', answer }]} />);

    expect(screen.queryByText('強調')).not.toBeInTheDocument();
    expect(document.querySelector('strong')).not.toBeInTheDocument();

    const answerNode = document.querySelector('p');
    expect(answerNode).not.toBeNull();
    // 改行を保っていることを確認するため、空白を正規化しない生の textContent で比較する
    expect(answerNode?.textContent).toBe(answer);
    expect(answerNode).toHaveClass('whitespace-pre-line');
  });
});
