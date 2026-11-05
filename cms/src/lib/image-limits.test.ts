import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { limitedSharp, MAX_INPUT_PIXELS } from './image-limits'

// 単色の JPEG は圧縮後が小さいため、上限を超える寸法でもテスト内で安く作れる
const solidJpeg = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#888' } }).jpeg().toBuffer()

describe('limitedSharp', () => {
  it('上限以下の画像は読める', async () => {
    expect((await limitedSharp(await solidJpeg(100, 100)).metadata()).width).toBe(100)
  })

  it('上限を超える画素数の画像は metadata の時点で拒否する', async () => {
    const side = Math.ceil(Math.sqrt(MAX_INPUT_PIXELS)) + 1
    await expect(limitedSharp(await solidJpeg(side, side)).metadata()).rejects.toThrow(/pixel limit/)
  })

  it('呼び出し側の options で上限を外せない', async () => {
    const side = Math.ceil(Math.sqrt(MAX_INPUT_PIXELS)) + 1
    await expect(
      limitedSharp(await solidJpeg(side, side), { limitInputPixels: false }).metadata(),
    ).rejects.toThrow(/pixel limit/)
  })
})
