import { createHash, randomBytes } from 'node:crypto';

export function generateCameraToken(): string {
  return randomBytes(32).toString('base64url');
}

// 256 ビットの乱数なので総当たりできず、ソルトや低速ハッシュは要らない。受信時にハッシュで引くため決定的であること
export function hashCameraToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
