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

  it('classifies North American venues by country, including incomplete addresses', () => {
    expect(detectRegion('Jacob K. Javits Convention Center', '', '655 West 34th Street Manhattan, New York 10001'))
      .toBe('美國')
    expect(detectRegion('Calgary TELUS Convention Centre', '', 'T2G 0K6 136 8th Avenue SE Calgary, Alberta, Canada'))
      .toBe('加拿大')
    expect(detectRegion('Edmonton Convention Centre', '', 'T5J 1N9 9797 Jasper Ave'))
      .toBe('加拿大')
  })

  it('classifies European venues by country when the address names it', () => {
    expect(detectRegion('OVO Arena Wembley', '', 'Arena Square, London, United Kingdom')).toBe('英國')
    expect(detectRegion('Olympia', '', '28 Boulevard des Capucines, Paris, France')).toBe('法國')
    expect(detectRegion('Uber Arena', '', 'Uber-Platz 1, Berlin, Deutschland')).toBe('德國')
  })

  it('classifies Korean venues from Korean and English canonical addresses', () => {
    expect(detectRegion(
      '高麗大学校 化汀体育館',
      '',
      '02841 서울특별시 성북구 안암로 145',
    )).toBe('韓國')
    expect(detectRegion('Olympic Hall', '', '424 Olympic-ro, Songpa-gu, Seoul, South Korea')).toBe('韓國')
    expect(detectRegion('Olympic Hall', '', '424 Olympic-ro, Songpa-gu, Seoul')).toBe('韓國')
  })

  it('classifies countries worldwide using localized country names', () => {
    expect(detectRegion('IMPACT Arena', '', 'ถนนป๊อปปูล่า จังหวัดนนทบุรี ประเทศไทย')).toBe('泰國')
    expect(detectRegion('IMPACT Arena', '', 'Popular Road, Bangkok')).toBe('泰國')
    expect(detectRegion('ICC Sydney', '', '14 Darling Drive, Sydney NSW, Australia')).toBe('澳洲')
    expect(detectRegion('Vibra São Paulo', '', 'São Paulo, Brasil')).toBe('巴西')
    expect(detectRegion('Coca-Cola Arena', '', 'Dubai, United Arab Emirates')).toBe('阿拉伯聯合大公國')
  })
})
