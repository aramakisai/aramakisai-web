import type { NextConfig } from 'next';
import path from 'node:path';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import './src/env';
import { DEV_OVERRIDE_ENABLED } from './src/lib/phase';

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // 既定では一部 UA 以外に streaming metadata (generateMetadata の非同期解決を
  // 待たずに先に <body> を送出する最適化) が効く。ルートの generateMetadata が
  // CMS フェッチを経るため、エラー境界の <title> より後にサイト既定タイトルの
  // <title> がマウントされ、React 19 の hoisting で既定タイトル側が勝ってしまう
  // (エラー画面のタイトルが巻き戻る)。全 UA を対象にして streaming を無効化し、
  // <head> を確定させてから送出させることでこの巻き戻りを防ぐ
  htmlLimitedBots: /.*/,
  webpack(config) {
    // next/dynamic は初期バンドルからの遅延分割に過ぎず、分割後のチャンクが
    // 成果物ディレクトリに残るため、開発用フラグ無効ビルドでの除去には使えない。
    // 解決先そのものを差し替えることで phase-toggle.tsx 本体をバンドル対象から外す。
    if (!DEV_OVERRIDE_ENABLED) {
      const real = path.resolve(__dirname, 'src/components/phase-toggle.tsx');
      const noop = path.resolve(
        __dirname,
        'src/components/phase-toggle-noop.tsx',
      );
      // RSC の client-reference は解決済みの絶対パスで扱われ、'@/...' specifier
      // への alias では横取りできない。絶対パスを alias 元にする。
      config.resolve.alias = {
        [real]: noop,
        ...config.resolve.alias,
      };
    }
    return config;
  },
};

export default nextConfig;
