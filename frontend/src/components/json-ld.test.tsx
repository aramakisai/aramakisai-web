import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonLd, serializeJsonLd } from './json-ld';

describe('serializeJsonLd', () => {
  it('通常のオブジェクトを JSON 文字列化する', () => {
    expect(serializeJsonLd({ '@type': 'Thing', name: 'foo' })).toBe(
      '{"@type":"Thing","name":"foo"}',
    );
  });

  it('</script> を含む文字列が渡っても script を閉じない', () => {
    const result = serializeJsonLd({
      name: '</script><script>alert(1)</script>',
    });
    expect(result).not.toContain('</script>');
    expect(result).not.toContain('<script>');
  });

  it('"<" を含む値を無害なエスケープに置換する', () => {
    expect(serializeJsonLd({ name: '1 < 2' })).toBe('{"name":"1 \\u003c 2"}');
  });
});

describe('JsonLd', () => {
  it('application/ld+json の script 要素を描画する', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Thing' }} />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    expect(script?.textContent).toBe('{"@type":"Thing"}');
  });

  it('データに </script> が混入していても DOM 上の script は 1 つのまま', () => {
    const { container } = render(
      <JsonLd data={{ name: '</script><script>evil()</script>' }} />,
    );
    expect(container.querySelectorAll('script')).toHaveLength(1);
  });
});
