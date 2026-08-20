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

  it('segments country names joined directly to the rest of a CJK address', () => {
    expect(detectRegion('MODERN SKY LAB', '', '中国上海市虹口区瑞虹路188号')).toBe('中國・上海')
    expect(detectRegion('MAO Livehouse', '', '中華人民共和国広東省広州市海珠区')).toBe('中國・廣州')
  })

  it('recognizes mainland Chinese administrative address units without a country prefix', () => {
    expect(detectRegion('深圳国际会展中心', '', '广东省深圳市宝安区福海街道展城路1号')).toBe('中國・深圳')
    expect(detectRegion('声音共和LIVEHOUSE', '', '广州市海珠区上冲南约大街')).toBe('中國・廣州')
    expect(detectRegion('Example Hall', '', '四川省成都市武侯区')).toBe('中國・成都')
  })

  it('recognizes common Macau names in Chinese and English', () => {
    expect(detectRegion('澳門百老匯-百老匯舞台 BROADWAY MACAU', '', '澳門路氹城蓮花海濱大馬路'))
      .toBe('澳門')
    expect(detectRegion('Broadway Theatre Macau')).toBe('澳門')
    expect(detectRegion('Broadway Theatre Macao')).toBe('澳門')
    expect(detectRegion('澳门百老汇')).toBe('澳門')
  })
})
