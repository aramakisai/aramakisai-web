import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import './src/env';

initOpenNextCloudflareForDev();

// repo-governance task 6.2: branch protection 必須ステータスチェック検証用の無害な変更
const nextConfig: NextConfig = {};

export default nextConfig;
