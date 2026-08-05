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

export function colorForRegion(region: string): string {
  return REGION_COLORS[region] ?? REGION_COLORS['其他地區']
}

export function detectRegion(venue: string, title = '', address = ''): string {
  const text = `${address} ${venue} ${title}`
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
