import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import './src/env';

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
