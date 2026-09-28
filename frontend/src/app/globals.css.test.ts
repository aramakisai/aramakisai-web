import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss, { type Rule } from 'postcss';

// クラス名の文字列一致ではなく実際の CSS 宣言を検査するため、globals.css を
// postcss でパースする (Tailwind 独自の at-rule も汎用構文として解釈できる)
const CSS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'globals.css',
);
const root = postcss.parse(readFileSync(CSS_PATH, 'utf8'));

// h1:not(.rich-text-body *) は「見出しの既定色」(複数セレクタの並び) と
// 「h1 のサイズ・行の高さ」(単独セレクタ) の 2 つの別ルールに現れるため、
// 単純な includes() では後勝ちで区別が付かない。一致するセレクタの個数で区別する
function findRuleBySelector(
  selector: string,
  exclusive: boolean,
): Rule | undefined {
  let found: Rule | undefined;
  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    if (exclusive === (rule.selectors.length === 1)) found = rule;
  });
  return found;
}

function declValue(rule: Rule, prop: string): string | undefined {
  let value: string | undefined;
  rule.walkDecls(prop, (decl) => {
    value = decl.value;
  });
  return value;
}

function applyParams(rule: Rule): string {
  let params = '';
  rule.walkAtRules('apply', (atRule) => {
    params += `${atRule.params} `;
  });
  return params;
}

describe('見出しの既定スタイル (h1〜h6)', () => {
  const rule = findRuleBySelector('h1', false);

  it('h1 を含む共有ルールが存在する', () => {
    expect(rule).toBeDefined();
  });

  it('ExtraBold (800) にする (要件 1.2)', () => {
    expect(declValue(rule!, 'font-weight')).toBe('800');
  });

  it('字間 2% にする (要件 1.2)', () => {
    expect(declValue(rule!, 'letter-spacing')).toBe('0.02em');
  });

  it('文節単位で折り返す (要件 1.6)', () => {
    expect(declValue(rule!, 'text-wrap')).toBe('balance');
    expect(declValue(rule!, 'word-break')).toBe('auto-phrase');
  });
});

describe('h1 のサイズ・行の高さ (要件 1.3)', () => {
  it('現行値 (44px / 120%) を保つ', () => {
    const rule = findRuleBySelector('h1:not(.rich-text-body *)', true);
    expect(rule).toBeDefined();
    const params = applyParams(rule!);
    expect(params).toContain('text-[44px]');
    expect(params).toContain('leading-[120%]');
  });
});

describe('本文 (body) のスタイル (要件 1.4)', () => {
  const rule = findRuleBySelector('body', true);

  it('行の高さ 180%', () => {
    expect(declValue(rule!, 'line-height')).toBe('1.8');
  });

  it('字間 2%', () => {
    expect(declValue(rule!, 'letter-spacing')).toBe('0.02em');
  });
});

describe('RichText 本文中の h2 (要件 1.5)', () => {
  it('25px にする', () => {
    const rule = findRuleBySelector('.rich-text-body h2', true);
    expect(rule).toBeDefined();
    expect(applyParams(rule!)).toContain('text-[25px]');
  });
});

describe('RichText 本文段落・引用の行の高さ (要件 1.4)', () => {
  it('.rich-text-body p を 180% にする', () => {
    const rule = findRuleBySelector('.rich-text-body p', true);
    expect(rule).toBeDefined();
    expect(applyParams(rule!)).toContain('leading-[1.8]');
  });

  it('.rich-text-body blockquote を 180% にする', () => {
    const rule = findRuleBySelector('.rich-text-body blockquote', true);
    expect(rule).toBeDefined();
    expect(applyParams(rule!)).toContain('leading-[1.8]');
  });
});

describe('見出しの既定色 (要件 2.1)', () => {
  it('color/primary ではなく color/text を使う', () => {
    const rule = findRuleBySelector('h1:not(.rich-text-body *)', false);
    expect(rule).toBeDefined();
    const params = applyParams(rule!);
    expect(params).toContain('text-text');
    expect(params).not.toContain('text-primary');
  });
});

describe('ページの地色 (要件 2.3)', () => {
  it('body の地を白にする (フッター等が使う background トークンの値は変えない)', () => {
    const rule = findRuleBySelector('body', true);
    expect(rule).toBeDefined();
    const params = applyParams(rule!);
    expect(params).toContain('bg-white');
    expect(params).not.toContain('bg-background');
  });
});

describe('本文領域の白い光彩 (要件 5.1, 5.2, 5.3)', () => {
  it('#main-content に光彩を付ける', () => {
    const rule = findRuleBySelector('#main-content', true);
    expect(rule).toBeDefined();
    expect(declValue(rule!, 'text-shadow')).toBe(
      '0 0 4px rgb(255 255 255 / 0.4)',
    );
  });

  it('白文字クラスとヒーローの部分木で打ち消す', () => {
    const rule = findRuleBySelector('.text-gray-50', false);
    expect(rule).toBeDefined();
    expect(rule!.selectors).toEqual(
      expect.arrayContaining(['.text-white', '[data-bg-hero]']),
    );
    expect(declValue(rule!, 'text-shadow')).toBe('none');
  });
});
