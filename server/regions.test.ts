import { describe, expect, it } from 'vitest'
import { detectRegion } from './regions.js'

describe('detectRegion', () => {
  it('treats the canonical address as authoritative over the event title', () => {
    expect(detectRegion('Example Hall', 'Hong Kong Tour', '東京都渋谷区宇田川町9番5号')).toBe('東京')
  })

  it('recognizes every Japanese prefecture instead of classifying it as other', () => {
    expect(detectRegion('Example Hall', '', '〒261-0023 千葉県千葉市美浜区中瀬2-1')).toBe('千葉')
    expect(detectRegion('Example Hall', '', '〒330-0081 埼玉県さいたま市中央区新都心8')).toBe('埼玉')
  })
})
