import { describe, expect, it } from 'vitest'
import { parseActorsFromEventDetailHtml } from './eventernoteSource'

describe('parseActorsFromEventDetailHtml', () => {
  it('only extracts actors from the detail-page actor row', () => {
    const html = `
      <table>
        <tr>
          <td>出演者</td>
          <td>
            <div class="gb_listview">
              <ul class="actors inline unstyled">
                <li><a href="/actors/ubique/88452">ubique</a></li>
                <li><a href="/actors/sana%28%E9%8E%96%E9%82%A3%29/16462">sana(鎖那)</a></li>
                <li><a href="/actors/%E7%80%AC%E5%90%8D%E8%88%AA/66704">瀬名航</a></li>
                <li><a href="/actors/Poppin%27Party/14234">Poppin&#39;Party</a></li>
              </ul>
            </div>
          </td>
        </tr>
      </table>
      <aside>
        <a href="/actors/%E3%80%8E%E3%83%A6%E3%82%A4%E3%82%AB%E3%80%8F/80694">『ユイカ』</a>
      </aside>
    `

    expect(parseActorsFromEventDetailHtml(html)).toEqual([
      'ubique',
      'sana(鎖那)',
      '瀬名航',
      "Poppin'Party",
    ])
  })
})