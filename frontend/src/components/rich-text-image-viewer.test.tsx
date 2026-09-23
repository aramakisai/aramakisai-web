import { render, screen, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, describe, vi, beforeAll } from 'vitest';
import { RichTextImageViewer } from './rich-text-image-viewer';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null, width?: number) =>
    id ? `https://example.com/assets/${id}/${width ?? 'original'}` : null,
}));

// jsdom は <dialog> の showModal/close を実装しない (2026-09 時点)。ネイティブの
// Esc での close イベント発火も含め、テストに必要な範囲だけ最小限に再現する。
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
    this.addEventListener('keydown', function onKeyDown(event) {
      if (event.key === 'Escape') {
        (event.currentTarget as HTMLDialogElement).close();
      }
    });
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

function renderBody(bodyHtml: string) {
  return render(
    <RichTextImageViewer>
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </RichTextImageViewer>,
  );
}

describe('RichTextImageViewer', () => {
  test('画像の選択でモーダルが開き、拡大画像に同じ alt が付く', () => {
    renderBody(
      '<p><img src="https://example.com/assets/42/original" alt="説明文" data-media-id="42"></p>',
    );

    fireEvent.click(screen.getByRole('button', { name: '画像を拡大: 説明文' }));

    const enlarged = screen.getByRole('dialog').querySelector('img');
    expect(enlarged).toHaveAttribute('alt', '説明文');
    expect(enlarged).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/42/'),
    );
  });

  test('リンクの選択ではモーダルが開かない', () => {
    renderBody('<p><a href="https://example.com">リンク</a></p>');

    fireEvent.click(screen.getByRole('link', { name: 'リンク' }));

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
      'open',
    );
  });

  test('閉じるボタンの選択で閉じて選択元へフォーカスが戻る', () => {
    renderBody(
      '<img src="https://example.com/assets/1/original" alt="画像" data-media-id="1">',
    );

    const trigger = screen.getByRole('button', { name: '画像を拡大: 画像' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveAttribute('open');

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
      'open',
    );
    expect(trigger).toHaveFocus();
  });

  test('Esc の選択で閉じて選択元へフォーカスが戻る', () => {
    renderBody(
      '<img src="https://example.com/assets/1/original" alt="画像" data-media-id="1">',
    );

    const trigger = screen.getByRole('button', { name: '画像を拡大: 画像' });
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
      'open',
    );
    expect(trigger).toHaveFocus();
  });

  test('背景の選択で閉じて選択元へフォーカスが戻る', () => {
    renderBody(
      '<img src="https://example.com/assets/1/original" alt="画像" data-media-id="1">',
    );

    const trigger = screen.getByRole('button', { name: '画像を拡大: 画像' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    // ダイアログ直下の背景領域 (画像・閉じるボタン以外) をクリックした状態を模す
    fireEvent.click(dialog.firstElementChild as Element);

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
      'open',
    );
    expect(trigger).toHaveFocus();
  });

  test('モーション停止時は開閉演出の transition クラス全てに対応する打ち消しクラスがある', () => {
    // 実装のクラス文字列を期待値としてそのまま書き写すと循環テストになるため、
    // 「transition を持つクラスには同じ variant 位置に motion-reduce:...:transition-none が
    // 対になって存在する」という構造だけを機械的に検算する。pseudo-element variant
    // (backdrop 等) は Tailwind の規則上クラス内で必ず最後の variant になるため、
    // motion-reduce はその手前に挿入されていなければならない。
    const PSEUDO_ELEMENT_VARIANTS = new Set([
      'backdrop',
      'before',
      'after',
      'placeholder',
      'file',
      'marker',
      'selection',
      'first-line',
      'first-letter',
    ]);

    function expectedMotionReduceOverride(transitionClass: string): string {
      const variants = transitionClass.split(':');
      variants.pop(); // 末尾の transition-[...] ユーティリティ自体を除く
      const pseudoIndex = variants.findIndex((v) =>
        PSEUDO_ELEMENT_VARIANTS.has(v),
      );
      if (pseudoIndex === -1) {
        return [...variants, 'motion-reduce', 'transition-none'].join(':');
      }
      return [
        ...variants.slice(0, pseudoIndex),
        'motion-reduce',
        variants[pseudoIndex],
        ...variants.slice(pseudoIndex + 1),
        'transition-none',
      ].join(':');
    }

    renderBody(
      '<img src="https://example.com/assets/1/original" alt="画像" data-media-id="1">',
    );

    const dialog = screen.getByRole('dialog', { hidden: true });
    const classes = dialog.className.split(' ');
    const transitionClasses = classes.filter((c) =>
      /(^|:)transition-(?!none)/.test(c),
    );

    expect(transitionClasses.length).toBeGreaterThan(0);
    for (const transitionClass of transitionClasses) {
      expect(classes).toContain(expectedMotionReduceOverride(transitionClass));
    }
  });

  test('拡大用ダイアログの中身は走査対象に含まれず data-rich-text-image ボタンを持たない', () => {
    renderBody(
      '<img src="https://example.com/assets/1/original" alt="画像" data-media-id="1">',
    );

    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(
      dialog.querySelectorAll('button[data-rich-text-image]'),
    ).toHaveLength(0);
  });

  test('スクリプトが動かない環境相当 (JS 未実行) では本文の画像がそのまま表示される', () => {
    // useEffect による img → button の包み替えはクライアント側マウント後にのみ走る。
    // renderToStaticMarkup はブラウザ JS を実行しないサーバー出力そのものなので、
    // ラップの有無で出力 HTML が変わらないことを見れば要件 15.18 を検証できる。
    const bodyHtml = '<img alt="画像" src="x">';
    const withoutViewer = renderToStaticMarkup(
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />,
    );
    const withViewer = renderToStaticMarkup(
      <RichTextImageViewer>
        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </RichTextImageViewer>,
    );

    expect(withViewer).toContain(withoutViewer);
    expect(withViewer).not.toContain('data-rich-text-image');
  });
});
