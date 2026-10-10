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
  // 旧サイト (/2025/*) の検索流入を受ける。詳細ページは slug/ID 体系が新サイトと
  // 異なり個別に対応付けられないため、対応する一覧ページへ集約する。
  // 対応先の無いもの (welcome, wp-*, 画像等) は意図的にリダイレクトしない
  async redirects() {
    const statusCode = 301;
    return [
      { source: '/2025', destination: '/', statusCode },
      { source: '/2025/about', destination: '/#about', statusCode },
      { source: '/2025/topics', destination: '/topics', statusCode },
      { source: '/2025/topics/:slug', destination: '/topics', statusCode },
      { source: '/2025/news/:slug', destination: '/announcements', statusCode },
      { source: '/2025/events', destination: '/exhibitions', statusCode },
      {
        source: '/2025/events/:slug*',
        destination: '/exhibitions',
        statusCode,
      },
      { source: '/2025/faqs', destination: '/faq', statusCode },
      { source: '/2025/faqs/:slug', destination: '/faq', statusCode },
      { source: '/2025/sponsors', destination: '/sponsors/ad', statusCode },
      {
        source: '/2025/local-sponsors',
        destination: '/sponsors/local',
        statusCode,
      },
      {
        source: '/2025/local-sponsors/:slug',
        destination: '/sponsors/local',
        statusCode,
      },
    ];
  },
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
