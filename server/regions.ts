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
  '其他地區': '#8a7c6e',
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
  return undefined
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
  return '其他地區'
}
