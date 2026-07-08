import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import './src/env';

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // repo-governance タスク6.2: deploy preview (Workers) の preview URL 取得検証用の無害な変更
};

export default nextConfig;
