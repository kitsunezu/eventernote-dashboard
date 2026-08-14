const REGION_COLORS: Record<string, string> = {
  '香港': '#e05858',
  '台北': '#4d9e7a',
  '東京': '#5b7bc4',
  '神奈川': '#4a9fa5',
  '大阪': '#e08842',
  '愛知': '#9b72b8',
  '福岡': '#c4a63a',
  '北海道': '#5b9ed4',
  '宮城': '#6b8f71',
  '広島': '#c47a5b',
  '京都': '#c45b8f',
  '兵庫': '#7b9bc4',
  '美國': '#3f78b5',
  '加拿大': '#d05a5a',
  '英國': '#6658a6',
  '法國': '#4078a8',
  '德國': '#565656',
  '其他地區': '#8a7c6e',
}

const COUNTRY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: '美國', pattern: /united states(?: of america)?|\bu\.?s\.?a\.?\b|アメリカ合衆国|美國|美国/i },
  { label: '加拿大', pattern: /canada|カナダ|加拿大/i },
  { label: '英國', pattern: /united kingdom|great britain|england|scotland|wales|northern ireland|イギリス|英国|英國/i },
  { label: '法國', pattern: /france|フランス|法国|法國/i },
  { label: '德國', pattern: /germany|deutschland|ドイツ|德国|德國/i },
  { label: '義大利', pattern: /italy|italia|イタリア|意大利|義大利/i },
  { label: '西班牙', pattern: /spain|españa|スペイン|西班牙/i },
  { label: '荷蘭', pattern: /netherlands|holland|オランダ|荷兰|荷蘭/i },
  { label: '比利時', pattern: /belgium|ベルギー|比利时|比利時/i },
  { label: '瑞士', pattern: /switzerland|スイス|瑞士/i },
  { label: '奧地利', pattern: /austria|オーストリア|奥地利|奧地利/i },
  { label: '愛爾蘭', pattern: /\bireland\b|アイルランド|爱尔兰|愛爾蘭/i },
  { label: '葡萄牙', pattern: /portugal|ポルトガル|葡萄牙/i },
  { label: '波蘭', pattern: /poland|ポーランド|波兰|波蘭/i },
  { label: '捷克', pattern: /czech(?:ia| republic)?|チェコ|捷克/i },
  { label: '瑞典', pattern: /sweden|スウェーデン|瑞典/i },
  { label: '挪威', pattern: /norway|ノルウェー|挪威/i },
  { label: '丹麥', pattern: /denmark|デンマーク|丹麦|丹麥/i },
  { label: '芬蘭', pattern: /finland|フィンランド|芬兰|芬蘭/i },
]

const US_STATE_AND_ZIP = /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s+\d{5}(?:-\d{4})?\b/i
const CANADIAN_POSTAL_CODE = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ]\s?\d[ABCEGHJ-NPRSTVWXYZ]\d\b/i
const US_CITY = /\b(?:new york|brooklyn|los angeles|chicago|atlanta|dallas|houston|phoenix|seattle|baltimore|honolulu|san jose|san francisco|fort worth)\b/i

export function detectCountry(text: string): string | undefined {
  const explicit = COUNTRY_PATTERNS.find(({ pattern }) => pattern.test(text))
  if (explicit) return explicit.label
  if (CANADIAN_POSTAL_CODE.test(text)) return '加拿大'
  if (US_STATE_AND_ZIP.test(text) || US_CITY.test(text)) return '美國'
  return undefined
}

const JAPANESE_PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const

export function extractJapanesePrefecture(address: string): string | undefined {
  return JAPANESE_PREFECTURES.find((candidate) => address.includes(candidate))
}

function detectRegionFromAddress(address: string): string | undefined {
  const prefecture = extractJapanesePrefecture(address)
  if (prefecture) return prefecture.replace(/[都府県]$/, '')
  if (/hong.?kong|香港/i.test(address)) return '香港'
  if (/taipei|台北|taiwan|台湾/i.test(address)) return '台北'
  return detectCountry(address)
}

export function colorForRegion(region: string): string {
  return REGION_COLORS[region] ?? REGION_COLORS['其他地區']
}

export function detectRegion(venue: string, title = '', address = ''): string {
  const addressRegion = detectRegionFromAddress(address)
  if (addressRegion) return addressRegion

  const text = `${venue} ${title}`
  if (/hong.?kong|asia.?world|asiaworld|香港/i.test(text)) return '香港'
  if (/taipei|台北|taiwan|台湾/i.test(text)) return '台北'
  if (/大阪|osaka|梅田|難波/i.test(text)) return '大阪'
  if (/愛知|名古屋|nagoya/i.test(text)) return '愛知'
  if (/福岡|fukuoka|博多/i.test(text)) return '福岡'
  if (/北海道|札幌|sapporo/i.test(text)) return '北海道'
  if (/宮城|仙台|sendai/i.test(text)) return '宮城'
  if (/広島|hiroshima/i.test(text)) return '広島'
  if (/東京|tokyo|渋谷|新宿|池袋|秋葉原|有明|六本木|お台場|水道橋/i.test(text)) return '東京'
  if (/京都|kyoto/i.test(text)) return '京都'
  if (/兵庫|神戸|kobe/i.test(text)) return '兵庫'
  if (/神奈川|横浜|川崎|yokohama|kawasaki/i.test(text)) return '神奈川'
  const country = detectCountry(text)
  if (country) return country
  return '其他地區'
}
