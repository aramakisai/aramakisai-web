import { describe, expect, it, vi } from 'vitest';
import { pickImageSize, toAssetUrl, toHeroImage } from './cms-asset-url';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:3100',
  },
}));

describe('pickImageSize', () => {
  it('幅の指定がない場合は既定サイズ (原本) を選ぶ', () => {
    expect(pickImageSize(undefined)).toBe('original');
  });

  it('指定幅を満たす最小の生成済みサイズを選ぶ', () => {
    expect(pickImageSize(500)).toBe('card');
    expect(pickImageSize(960)).toBe('card');
  });

  it('card を超える幅では hero を選ぶ', () => {
    expect(pickImageSize(961)).toBe('hero');
    expect(pickImageSize(1920)).toBe('hero');
  });

  it('どのサイズも満たさない幅では最大サイズを選ぶ', () => {
    expect(pickImageSize(3000)).toBe('hero');
  });
});

describe('toAssetUrl', () => {
  it('fileIdがnullの場合、nullを返す', () => {
    expect(toAssetUrl(null)).toBeNull();
  });

  it('fileIdが指定された場合、既定サイズのURLを返す', () => {
    expect(toAssetUrl('42')).toBe(
      'http://localhost:3100/api/media/serve/42/original',
    );
  });

  it('widthが指定された場合、対応するサイズのURLを返す', () => {
    expect(toAssetUrl('42', 1920)).toBe(
      'http://localhost:3100/api/media/serve/42/hero',
    );
    expect(toAssetUrl('42', 960)).toBe(
      'http://localhost:3100/api/media/serve/42/card',
    );
  });
});

describe('toHeroImage', () => {
  const base = { id: '7', filenameDownload: '', type: null, filesize: null };

  it('card と hero の実ファイル URL から srcSet を組み立てる', () => {
    expect(
      toHeroImage({
        ...base,
        url: '/api/media/file/a.jpg',
        cardUrl: '/api/media/file/a-960.webp',
        heroUrl: '/api/media/file/a-1920.webp',
      }),
    ).toEqual({
      src: 'http://localhost:3100/api/media/file/a-1920.webp',
      srcSet:
        'http://localhost:3100/api/media/file/a-960.webp 960w, http://localhost:3100/api/media/file/a-1920.webp 1920w',
    });
  });

  it('派生サイズが無ければ原本を src にし srcSet は付けない', () => {
    expect(toHeroImage({ ...base, url: '/api/media/file/a.jpg' })).toEqual({
      src: 'http://localhost:3100/api/media/file/a.jpg',
      srcSet: undefined,
    });
  });

  it('ID しか無い場合は serve URL にフォールバックする', () => {
    expect(toHeroImage(base)).toEqual({
      src: 'http://localhost:3100/api/media/serve/7/hero',
    });
  });
});
