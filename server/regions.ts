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

const COUNTRY_NAME_LOCALES = [
  'en', 'ja', 'zh-TW', 'zh-CN', 'ko', 'th', 'fr', 'de', 'es', 'pt', 'it', 'ru', 'ar',
] as const

const COUNTRY_LABEL_OVERRIDES: Record<string, string> = {
  KR: '韓國',
  MO: '澳門',
}

const COUNTRY_ALIAS_OVERRIDES: Record<string, string[]> = {
  CN: [
    'Mainland China', 'People\'s Republic of China', 'PRC',
    '中国大陆', '中國大陸', '中华人民共和国', '中華人民共和國', '中華人民共和国',
  ],
  GB: ['Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  KR: ['Korea', 'Republic of Korea'],
  MO: ['澳門', '澳门', 'Macau', 'Macao'],
  NL: ['Holland'],
  US: ['United States of America', 'U.S.A.', 'USA'],
}

const COUNTRY_HINTS: Array<{ code: string; pattern: RegExp }> = [
  {
    code: 'CN',
    pattern: /(?:[\p{Script=Han}]{2,12}(?:省|自治区|自治區)|(?:北京|上海|天津|重庆|重慶|广州|廣州|深圳|东莞|東莞)市)|\b(?:beijing|shanghai|tianjin|chongqing|guangdong|guangzhou|shenzhen|dongguan|jiangsu|zhejiang|fujian|sichuan|hubei|hunan)\s+(?:sheng|shi)\b/iu,
  },
  {
    code: 'KR',
    pattern: /대한민국|한국|서울(?:특별시)?|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원(?:특별자치도|도)|충청[남북]도|전[남북](?:특별자치)?도|경상[남북]도|제주특별자치도|\b(?:seoul|busan|incheon|daegu|daejeon|gwangju|ulsan|jeju)\b/i,
  },
  { code: 'TH', pattern: /[\u0E00-\u0E7F]|\b(?:bangkok|chiang mai|pattaya|phuket)\b/iu },
]

const traditionalCountryNames = new Intl.DisplayNames(['zh-TW'], { type: 'region' })
const englishCountryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const localizedCountryNames = COUNTRY_NAME_LOCALES.map((locale) => {
  return new Intl.DisplayNames([locale], { type: 'region' })
})
const locationWordSegmenter = new Intl.Segmenter([...COUNTRY_NAME_LOCALES], { granularity: 'word' })

function countryLabel(code: string): string {
  return COUNTRY_LABEL_OVERRIDES[code] ?? traditionalCountryNames.of(code) ?? code
}

export function regionForCountryCode(code: string): string | undefined {
  const normalizedCode = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalizedCode)) return undefined
  const label = countryLabel(normalizedCode)
  return label === normalizedCode ? undefined : label
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeLocationWord(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase()
}

function semanticLocationWords(value: string): Set<string> {
  return new Set(Array.from(locationWordSegmenter.segment(normalizeLocationWord(value)))
    .filter((part) => part.isWordLike)
    .map((part) => part.segment))
}

function supportsSemanticWordMatch(alias: string): boolean {
  return /^\p{Script=Han}+$/u.test(alias)
}

function aliasPattern(alias: string): RegExp {
  const escaped = escapeRegExp(normalizeLocationWord(alias))
  return new RegExp(`(?:^|[^\\p{L}])${escaped}(?:$|[^\\p{L}])`, 'iu')
}

const COUNTRY_PATTERNS: Array<{ label: string; aliases: string[]; patterns: RegExp[] }> = []
for (let first = 65; first <= 90; first += 1) {
  for (let second = 65; second <= 90; second += 1) {
    const code = String.fromCharCode(first, second)
    const englishName = englishCountryNames.of(code)
    if (!englishName || englishName === code || englishName === 'Unknown Region') continue
    const aliases = new Set([
      ...localizedCountryNames.map((names) => names.of(code)),
      ...(COUNTRY_ALIAS_OVERRIDES[code] ?? []),
    ].filter((name): name is string => Boolean(name && name !== code && name !== '未知區域')))
    const normalizedAliases = Array.from(aliases, normalizeLocationWord)
    COUNTRY_PATTERNS.push({
      label: countryLabel(code),
      aliases: normalizedAliases,
      patterns: normalizedAliases.map(aliasPattern),
    })
  }
}

const US_STATE_AND_ZIP = /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s+\d{5}(?:-\d{4})?\b/i
const CANADIAN_POSTAL_CODE = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ]\s?\d[ABCEGHJ-NPRSTVWXYZ]\d\b/i
const US_CITY = /\b(?:new york|brooklyn|los angeles|chicago|atlanta|dallas|houston|phoenix|seattle|baltimore|honolulu|san jose|san francisco|fort worth)\b/i

const CHINESE_CITY_LABELS: Record<string, string> = {
  '北京': '北京',
  '上海': '上海',
  '天津': '天津',
  '重庆': '重慶',
  '重慶': '重慶',
  '广州': '廣州',
  '廣州': '廣州',
  '広州': '廣州',
  '深圳': '深圳',
  '东莞': '東莞',
  '東莞': '東莞',
}

const CHINESE_CITY_ALIASES: Array<{ label: string; pattern: RegExp }> = [
  { label: '北京', pattern: /北京|\bbeijing\b/iu },
  { label: '上海', pattern: /上海|\bshanghai\b/iu },
  { label: '天津', pattern: /天津|\btianjin\b/iu },
  { label: '重慶', pattern: /重庆|重慶|\bchongqing\b/iu },
  { label: '廣州', pattern: /广州|廣州|広州|\bguangzhou\b|\bcanton\b/iu },
  { label: '深圳', pattern: /深圳|\bshenzhen\b/iu },
  { label: '東莞', pattern: /东莞|東莞|\bdongguan\b/iu },
]

export function detectCountry(text: string): string | undefined {
  const normalizedText = text.normalize('NFKC')
  const words = semanticLocationWords(normalizedText)
  const hint = COUNTRY_HINTS.find(({ pattern }) => pattern.test(normalizedText))
  if (hint) return countryLabel(hint.code)
  const explicit = COUNTRY_PATTERNS.find(({ aliases, patterns }) => {
    return aliases.some((alias) => supportsSemanticWordMatch(alias) && words.has(alias))
      || patterns.some((pattern) => pattern.test(normalizedText))
  })
  if (explicit) return explicit.label
  if (CANADIAN_POSTAL_CODE.test(normalizedText)) return '加拿大'
  if (US_STATE_AND_ZIP.test(normalizedText) || US_CITY.test(normalizedText)) return '美國'
  return undefined
}

export function extractChineseCity(text: string): string | undefined {
  const normalizedText = text.normalize('NFKC')
  const knownCity = CHINESE_CITY_ALIASES.find(({ pattern }) => pattern.test(normalizedText))
  if (knownCity) return knownCity.label

  const city = normalizedText.match(/(?:省|自治区|自治區)([\p{Script=Han}]{2,8})市/u)?.[1]
  if (!city) return undefined
  return CHINESE_CITY_LABELS[city] ?? city
}

function chineseRegion(text: string): string {
  const city = extractChineseCity(text)
  return city ? `中國・${city}` : '中國'
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
  const country = detectCountry(address)
  return country === '中國' ? chineseRegion(address) : country
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
  if (country) return country === '中國' ? chineseRegion(text) : country
  return '其他地區'
}
