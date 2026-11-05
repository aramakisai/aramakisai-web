import type { SharpDependency } from 'payload'
import sharp from 'sharp'

/**
 * デコードする画素数の上限。本番の cms / worker の memory limit (どちらも 512Mi) の 25% を
 * RGBA 4 byte/pixel で割った値 (128MiB / 4 = 33,554,432)。
 * 圧縮後のサイズが小さくても、巨大な寸法の画像はデコードでメモリを使い切る
 */
export const MAX_INPUT_PIXELS = 33_554_432

// 呼び出し側の options で上限を外せないよう、limitInputPixels は後ろで固定する
export const limitedSharp: SharpDependency = (input, options) =>
  sharp(input, { ...options, limitInputPixels: MAX_INPUT_PIXELS })
