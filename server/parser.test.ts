import { describe, expect, it } from 'vitest'
import { parseEventDetail, parseEventTimes, parsePlaceDetail, parseUserEventsPage } from './parser.js'

describe('parseUserEventsPage', () => {
  it('discovers event IDs and pagination paths from a user list page', () => {
    const html = `
      <ul>
        <li class="clearfix">
          <div class="date"><p>2026-08-14 (金)</p><img src="/images/events/475077_s.jpg" alt="preview"></div>
          <div class="event">
            <h4><a href="/events/475077">List title</a></h4>
            <div class="place"><a href="/places/9090">Short venue</a><span class="s">開場 19:00 開演 20:00 終演 22:00</span></div>
            <ul class="actor"><li><a>RAISE A SUILEN</a></li></ul>
          </div>
        </li>
      </ul>
      <div class="pagination">
        <a href="/users/test/events?page=1">1</a>
        <a href="/users/test/events?page=2">2</a>
        <a href="/users/test/events?page=2">next</a>
      </div>
    `

    expect(parseUserEventsPage(html)).toEqual({
      events: [{
        id: '475077',
        title: 'List title',
        startAt: '2026-08-14T20:00:00',
        endAt: '2026-08-14T22:00:00',
        placeId: '9090',
        venue: 'Short venue',
        actors: ['RAISE A SUILEN'],
        imageUrl: 'https://www.eventernote.com/images/events/475077_s.jpg',
        imageAlt: 'preview',
      }],
      paginationPaths: ['/users/test/events?page=2'],
    })
  })
})

describe('parseEventDetail', () => {
  it('uses the detail page as the authoritative event source', () => {
    const html = `
      <meta property="og:image" content="https://cdn.example/475077.jpg">
      <div class="gb_events_detail_title"><h2>Accurate detail title</h2></div>
      <div class="gb_events_info_table"><table>
        <tr><td>開催日時</td><td><a>2026-08-14 (金)</a></td></tr>
        <tr><td>時間</td><td>開場 - 開演 20:00 終演 22:00</td></tr>
        <tr><td>開催場所</td><td><a href="/places/9090">AsiaWorld-Expo Hall 10</a></td></tr>
        <tr><td>出演者</td><td><ul class="actors"><li><a href="/actors/a/1">Artist A</a></li><li><a href="/actors/b/2">Artist B</a></li></ul></td></tr>
        <tr><td><img src="https://cdn.example/475077.jpg"></td><td>Official description</td></tr>
      </table></div>
    `

    expect(parseEventDetail(html, '475077')).toEqual({
      id: '475077',
      title: 'Accurate detail title',
      startAt: '2026-08-14T20:00:00',
      endAt: '2026-08-14T22:00:00',
      placeId: '9090',
      venue: 'AsiaWorld-Expo Hall 10',
      actors: ['Artist A', 'Artist B'],
      imageUrl: 'https://cdn.example/475077.jpg',
      imageAlt: 'Accurate detail title',
      description: 'Official description',
    })
  })

  it('handles events that finish after midnight', () => {
    expect(parseEventTimes('2026-08-14', '開場 23:30 開演 00:15 終演 02:00')).toEqual({
      startAt: '2026-08-15T00:15:00',
      endAt: '2026-08-15T02:00:00',
    })
  })
})

describe('parsePlaceDetail', () => {
  it('extracts address, region, and coordinates', () => {
    const html = `
      <div class="gb_place_detail_title"><h2>Example Hall</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td><a>〒161-0033 東京都新宿区下落合3-20-21</a></td></tr>
      </table></div>
      <script>var lat = '35.72294'; var lon = '139.70256';</script>
    `

    expect(parsePlaceDetail(html, '123', 'Fallback')).toEqual({
      id: '123',
      name: 'Example Hall',
      address: '〒161-0033 東京都新宿区下落合3-20-21',
      region: '東京',
      latitude: 35.72294,
      longitude: 139.70256,
    })
  })

  it('keeps an address but rejects Eventernote placeholder coordinates', () => {
    const html = `
      <div class="gb_place_detail_title"><h2>Shibuya LOVEZ</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td><a>〒150-0042 東京都渋谷区宇田川町9番5号 Shibuya LOVEZ</a></td></tr>
      </table></div>
      <script>var lat = '0'; var lon = '0';</script>
    `

    expect(parsePlaceDetail(html, '18844', 'Fallback')).toEqual({
      id: '18844',
      name: 'Shibuya LOVEZ',
      address: '〒150-0042 東京都渋谷区宇田川町9番5号 Shibuya LOVEZ',
      region: '東京',
      latitude: undefined,
      longitude: undefined,
    })
  })
})
