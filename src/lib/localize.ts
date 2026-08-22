import type { EventCategory, EventLink, ScheduleEvent, SupportedLocale } from '../types/events'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-Hant', 'en', 'ja']

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  'zh-Hant': '繁中',
  en: 'EN',
  ja: '日本語',
}

interface UiCopy {
  viewerEyebrow: string
  viewerTitle: string
  darkMode: string
  lightMode: string
  noUpcoming: string
  details: string
  close: string
  when: string
  where: string
  summary: string
  notes: string
  links: string
  emptyTitle: string
  landingTitle: string
  landingDesc: string
  landingSubmit: string
  actorLandingDesc: string
  actorSearchPlaceholder: string
  actorSearchLoading: string
  actorSearchEmpty: string
  actorSearchError: string
  loadingText: string
  loadErrorTitle: string
  loadRetry: string
  noEventsTitle: string
  loadedCount: (count: number) => string
  loadFailed: string
  refreshData: string
  refreshing: string
  lastUpdated: (minutesAgo: number) => string
}

const UI_COPY: Record<SupportedLocale, UiCopy> = {
  'zh-Hant': {
    viewerEyebrow: 'Eventernote Dashboard',
    viewerTitle: 'Eventernote Dashboard',
    darkMode: '深色模式',
    lightMode: '亮色模式',
    noUpcoming: '目前顯示範圍內沒有即將到來的事件。',
    details: '事件詳情',
    close: '關閉',
    when: '時間',
    where: '地點',
    summary: '出演者',
    notes: '備註',
    links: '連結',
    emptyTitle: '這個顯示範圍內沒有行程。',
    landingTitle: '活動列表',
    landingDesc: '輸入 Eventernote 用戶 ID，即可一覽參加活動。',
    landingSubmit: '查看',
    actorLandingDesc: '搜尋 Eventernote 聲優或藝人，即可查看出演活動。',
    actorSearchPlaceholder: '輸入聲優／藝人名稱',
    actorSearchLoading: '搜尋中…',
    actorSearchEmpty: '找不到相符的聲優／藝人',
    actorSearchError: '暫時無法搜尋，請稍後再試。',
    loadingText: '載入中…',
    loadErrorTitle: '載入錯誤',
    loadRetry: '重試',
    noEventsTitle: '沒有活動',
    loadedCount: (count) => `已載入 ${count} 個活動。`,
    loadFailed: '活動載入失敗。',
    refreshData: '重新整理',
    refreshing: '更新中…',
    lastUpdated: (min) => min === 0 ? '剛剛更新' : `${min} 分鐘前更新`,
  },
  en: {
    viewerEyebrow: 'Eventernote Dashboard',
    viewerTitle: 'Eventernote Dashboard',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    noUpcoming: 'No upcoming events in the current range.',
    details: 'Event details',
    close: 'Close',
    when: 'When',
    where: 'Where',
    summary: 'Performers',
    notes: 'Notes',
    links: 'Links',
    emptyTitle: 'No events are visible in this range.',
    landingTitle: 'Event Schedule',
    landingDesc: 'Enter an Eventernote user ID to browse your event schedule.',
    landingSubmit: 'View',
    actorLandingDesc: 'Search Eventernote for a performer to browse their events.',
    actorSearchPlaceholder: 'Search performers',
    actorSearchLoading: 'Searching…',
    actorSearchEmpty: 'No matching performers',
    actorSearchError: 'Search is unavailable. Please try again later.',
    loadingText: 'Loading…',
    loadErrorTitle: 'Load error',
    loadRetry: 'Retry',
    noEventsTitle: 'No events',
    loadedCount: (count) => `Loaded ${count} event${count === 1 ? '' : 's'}.`,
    loadFailed: 'Failed to load events.',
    refreshData: 'Refresh',
    refreshing: 'Refreshing…',
    lastUpdated: (min) => min === 0 ? 'Just updated' : `Updated ${min}m ago`,
  },
  ja: {
    viewerEyebrow: 'Eventernote Dashboard',
    viewerTitle: 'Eventernote Dashboard',
    darkMode: 'ダークモード',
    lightMode: 'ライトモード',
    noUpcoming: '現在の表示範囲に予定はありません。',
    details: 'イベント詳細',
    close: '閉じる',
    when: '時間',
    where: '場所',
    summary: '出演者',
    notes: 'メモ',
    links: 'リンク',
    emptyTitle: 'この表示範囲には予定がありません。',
    landingTitle: 'イベント一覧',
    landingDesc: 'Eventernote のユーザー ID を入力すると、参加イベントを一覧表示します。',
    landingSubmit: '表示する',
    actorLandingDesc: 'Eventernote の声優・アーティストを検索して、出演イベントを表示します。',
    actorSearchPlaceholder: '声優・アーティスト名を検索',
    actorSearchLoading: '検索中…',
    actorSearchEmpty: '一致する声優・アーティストが見つかりません',
    actorSearchError: '検索できませんでした。しばらくしてからもう一度お試しください。',
    loadingText: '読み込み中…',
    loadErrorTitle: '読み込みエラー',
    loadRetry: '再試行',
    noEventsTitle: 'イベントなし',
    loadedCount: (count) => `${count} 件のイベントを読み込みました。`,
    loadFailed: 'イベントの読み込みに失敗しました。',
    refreshData: '更新',
    refreshing: '更新中…',
    lastUpdated: (min) => min === 0 ? '今更新しました' : `${min}分前に更新`,
  },
}

export function getUiCopy(locale: SupportedLocale): UiCopy {
  return UI_COPY[locale]
}

export interface ReportCopy {
  landingTitle: string
  landingDesc: string
  landingSubmit: string
  eyebrow: string
  title: (userId: string) => string
  subtitle: string
  back: string
  refresh: string
  indexPreparing: string
  indexProgress: (indexed: number, total: number) => string
  allYears: string
  attendedEvents: string
  venues: string
  regions: string
  artists: string
  venueRanking: string
  regionBreakdown: string
  artistRanking: string
  activityByMonth: string
  venueMap: string
  openMap: string
  mapHint: string
  mapCoverage: (mapped: number, total: number) => string
  mapRefresh: string
  mapRefreshing: string
  mapRefreshUnavailable: string
  mapRefreshComplete: string
  mapRefreshPartial: string
  mapRefreshFailed: string
  eventOccurrences: (count: number) => string
  approximateLocation: string
  expandEvents: (name: string, count: number) => string
  loadMoreRankings: (visible: number, total: number) => string
  downloadImage: string
  share: string
  shareTo: string
  shareText: (userId: string, eventCount: number) => string
  imageReady: string
  shareCopied: string
  shareFailed: string
  noReportTitle: string
  noReportBody: string
  unknownVenue: string
  noArtistData: string
  actorTitle: (name: string) => string
  actorSubtitle: string
  actorAttendedEvents: string
  actorArtists: string
  actorArtistRanking: string
  actorShareText: (name: string, eventCount: number) => string
  actorEventOccurrences: (count: number) => string
  actorExpandEvents: (name: string, count: number) => string
  actorNoReportTitle: string
  actorNoReportBody: string
}

const REPORT_COPY: Record<SupportedLocale, ReportCopy> = {
  'zh-Hant': {
    landingTitle: '活動統計報告',
    landingDesc: '按年份整理會場、地區與藝人。',
    landingSubmit: '產出報告',
    eyebrow: 'Attendance report',
    title: (userId) => `${userId} 的活動足跡`,
    subtitle: '把去過的現場，整理成一份值得回看的紀錄。',
    back: '返回首頁',
    refresh: '重新整理資料',
    indexPreparing: '正在讀取 Eventernote 活動總數…',
    indexProgress: (indexed, total) => `正在建立活動索引：${indexed} / ${total}`,
    allYears: '所有年份',
    attendedEvents: '參加活動',
    venues: '去過會場',
    regions: '足跡地區',
    artists: '看過藝人',
    venueRanking: '最常去的會場',
    regionBreakdown: '活動地區',
    artistRanking: '最常看的藝人',
    activityByMonth: '月份分布',
    venueMap: '會場地圖',
    openMap: '在地圖開啟',
    mapHint: '目前統計範圍內的會場會同時標記，未定位的會場將自動分批補齊。',
    mapCoverage: (mapped, total) => `已標記 ${mapped} / ${total} 個會場`,
    mapRefresh: '重新尋找未標記會場',
    mapRefreshing: '正在重新尋找未標記會場',
    mapRefreshUnavailable: '沒有可重新搜尋的未標記會場',
    mapRefreshComplete: '未標記會場已重新尋找完成。',
    mapRefreshPartial: '重新尋找完成，部分會場仍無法標記。',
    mapRefreshFailed: '無法重新尋找未標記會場，請稍後再試。',
    eventOccurrences: (count) => `${count} 場活動`,
    approximateLocation: '城市級約略位置',
    expandEvents: (name, count) => `展開 ${name} 的 ${count} 場活動`,
    loadMoreRankings: (visible, total) => `載入更多（已顯示 ${visible} / ${total}）`,
    downloadImage: '下載報告圖片',
    share: '分享',
    shareTo: '分享到 SNS',
    shareText: (userId, eventCount) => `${userId} 的 Eventernote 活動報告：共參加 ${eventCount} 場活動`,
    imageReady: '報告圖片已下載。',
    shareCopied: '分享連結已複製。',
    shareFailed: '暫時無法分享，請稍後再試。',
    noReportTitle: '這個範圍還沒有已參加的活動',
    noReportBody: '切換到其他年份，或重新整理 Eventernote 資料。',
    unknownVenue: '未記錄會場',
    noArtistData: 'Eventernote 沒有提供藝人資料',
    actorTitle: (name) => `${name} 的演出足跡`,
    actorSubtitle: '把演出過的現場，整理成一份值得回看的紀錄。',
    actorAttendedEvents: '演出活動',
    actorArtists: '同場演出的藝人',
    actorArtistRanking: '最常同場演出的藝人',
    actorShareText: (name, eventCount) => `${name} 的 Eventernote 演出活動報告：共 ${eventCount} 場演出活動`,
    actorEventOccurrences: (count) => `${count} 場演出活動`,
    actorExpandEvents: (name, count) => `展開 ${name} 的 ${count} 場演出活動`,
    actorNoReportTitle: '這個範圍還沒有演出活動',
    actorNoReportBody: '切換到其他年份，或重新整理 Eventernote 資料。',
  },
  en: {
    landingTitle: 'Attendance report',
    landingDesc: 'Explore venues, regions, and artists by year.',
    landingSubmit: 'Create report',
    eyebrow: 'Attendance report',
    title: (userId) => `${userId}'s live event footprint`,
    subtitle: 'A personal record of the live events you have attended.',
    back: 'Back to home',
    refresh: 'Refresh data',
    indexPreparing: 'Reading the total activity count from Eventernote…',
    indexProgress: (indexed, total) => `Building activity index: ${indexed} / ${total}`,
    allYears: 'All years',
    attendedEvents: 'Events attended',
    venues: 'Venues visited',
    regions: 'Regions visited',
    artists: 'Artists seen',
    venueRanking: 'Most visited venues',
    regionBreakdown: 'Event regions',
    artistRanking: 'Most seen artists',
    activityByMonth: 'Events by month',
    venueMap: 'Venue map',
    openMap: 'Open in maps',
    mapHint: 'Venues in the current report range are shown together, with unmapped venues filled in automatically in batches.',
    mapCoverage: (mapped, total) => `${mapped} of ${total} venues mapped`,
    mapRefresh: 'Retry unmapped venues',
    mapRefreshing: 'Retrying unmapped venues',
    mapRefreshUnavailable: 'No unmapped venues can be retried',
    mapRefreshComplete: 'Finished retrying unmapped venues.',
    mapRefreshPartial: 'Retry finished, but some venues are still unmapped.',
    mapRefreshFailed: 'Could not retry unmapped venues. Please try again later.',
    eventOccurrences: (count) => `${count} event${count === 1 ? '' : 's'}`,
    approximateLocation: 'Approximate city location',
    expandEvents: (name, count) => `Show ${count} events for ${name}`,
    loadMoreRankings: (visible, total) => `Load more (${visible} of ${total} shown)`,
    downloadImage: 'Download report image',
    share: 'Share',
    shareTo: 'Share to social media',
    shareText: (userId, eventCount) => `${userId}'s Eventernote report: ${eventCount} events attended`,
    imageReady: 'Report image downloaded.',
    shareCopied: 'Share link copied.',
    shareFailed: 'Sharing is unavailable right now.',
    noReportTitle: 'No attended events in this range',
    noReportBody: 'Choose another year or refresh your Eventernote data.',
    unknownVenue: 'Venue not recorded',
    noArtistData: 'No artist data from Eventernote',
    actorTitle: (name) => `${name}'s performance footprint`,
    actorSubtitle: 'A record of the live events where this performer appeared.',
    actorAttendedEvents: 'Performances',
    actorArtists: 'Co-performers',
    actorArtistRanking: 'Most frequent co-performers',
    actorShareText: (name, eventCount) => `${name}'s Eventernote performance report: ${eventCount} appearances`,
    actorEventOccurrences: (count) => `${count} appearance${count === 1 ? '' : 's'}`,
    actorExpandEvents: (name, count) => `Show ${count} appearances with ${name}`,
    actorNoReportTitle: 'No performances in this range',
    actorNoReportBody: 'Choose another year or refresh the Eventernote data.',
  },
  ja: {
    landingTitle: 'イベント統計レポート',
    landingDesc: '会場・地域・出演者を年ごとに集計します。',
    landingSubmit: 'レポートを作る',
    eyebrow: 'Attendance report',
    title: (userId) => `${userId}さんのイベント記録`,
    subtitle: '参加した現場を、振り返りたくなるレポートに。',
    back: 'ホームへ戻る',
    refresh: 'データを更新',
    indexPreparing: 'Eventernoteからイベント総数を取得しています…',
    indexProgress: (indexed, total) => `イベント索引を作成中：${indexed} / ${total}`,
    allYears: 'すべての年',
    attendedEvents: '参加イベント',
    venues: '訪れた会場',
    regions: '訪れた地域',
    artists: '見た出演者',
    venueRanking: 'よく行く会場',
    regionBreakdown: '開催地域',
    artistRanking: 'よく見る出演者',
    activityByMonth: '月別イベント数',
    venueMap: '会場マップ',
    openMap: '地図で開く',
    mapHint: '現在の集計範囲にある会場を表示し、未表示の会場は自動で順次取得します。',
    mapCoverage: (mapped, total) => `${mapped} / ${total} 会場を表示`,
    mapRefresh: '未表示の会場を再検索',
    mapRefreshing: '未表示の会場を再検索中',
    mapRefreshUnavailable: '再検索できる未表示の会場はありません',
    mapRefreshComplete: '未表示の会場を再検索しました。',
    mapRefreshPartial: '再検索しましたが、一部の会場はまだ表示できません。',
    mapRefreshFailed: '未表示の会場を再検索できませんでした。後でもう一度お試しください。',
    eventOccurrences: (count) => `${count} 件のイベント`,
    approximateLocation: '都市単位の概算位置',
    expandEvents: (name, count) => `${name}のイベント ${count} 件を表示`,
    loadMoreRankings: (visible, total) => `さらに読み込む（${visible} / ${total} 件表示）`,
    downloadImage: 'レポート画像を保存',
    share: '共有',
    shareTo: 'SNS に共有',
    shareText: (userId, eventCount) => `${userId}さんの Eventernote レポート：参加イベント ${eventCount} 件`,
    imageReady: 'レポート画像を保存しました。',
    shareCopied: '共有リンクをコピーしました。',
    shareFailed: '現在共有できません。',
    noReportTitle: 'この期間に参加済みイベントはありません',
    noReportBody: '別の年を選ぶか、Eventernote データを更新してください。',
    unknownVenue: '会場未登録',
    noArtistData: '出演者情報がありません',
    actorTitle: (name) => `${name}の出演記録`,
    actorSubtitle: '出演したイベントを、振り返りやすいレポートにまとめます。',
    actorAttendedEvents: '出演イベント',
    actorArtists: '共演アーティスト',
    actorArtistRanking: '共演回数の多いアーティスト',
    actorShareText: (name, eventCount) => `${name}の Eventernote 出演レポート：出演イベント ${eventCount} 件`,
    actorEventOccurrences: (count) => `出演イベント ${count} 件`,
    actorExpandEvents: (name, count) => `${name}の出演イベント ${count} 件を表示`,
    actorNoReportTitle: 'この期間には出演イベントがありません',
    actorNoReportBody: '別の年を選ぶか、Eventernote データを更新してください。',
  },
}

export function getReportCopy(locale: SupportedLocale): ReportCopy {
  return REPORT_COPY[locale]
}

export function formatDayRangeOption(locale: SupportedLocale, days: 'all' | 'future'): string {
  const labels: Record<SupportedLocale, Record<'all' | 'future', string>> = {
    'zh-Hant': {
      all: '所有',
      future: '未來',
    },
    en: {
      all: 'All',
      future: 'Future',
    },
    ja: {
      all: 'すべて',
      future: '今後',
    },
  }

  return labels[locale][days]
}

export function resolveCategoryLabel(category: EventCategory, locale: SupportedLocale): string {
  return category.labels?.[locale] ?? category.label
}

export function resolveLinkLabel(link: EventLink, locale: SupportedLocale): string {
  return link.localizedLabel?.[locale] ?? link.label
}

export function resolveEventCopy(event: ScheduleEvent, locale: SupportedLocale) {
  const localized = event.localized?.[locale]

  return {
    title: localized?.title ?? event.title,
    description: localized?.description ?? event.description,
    notes: localized?.notes ?? event.notes,
    location: localized?.location ?? event.location,
    categoryLabel: resolveCategoryLabel(event.category, locale),
    previewAlt: event.previewImageAlt ?? (localized?.title ?? event.title),
  }
}
