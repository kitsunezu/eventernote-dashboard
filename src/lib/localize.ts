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
  viewerDescription: string
  managedHint: string
  timeline: string
  agenda: string
  darkMode: string
  lightMode: string
  nextEvent: string
  noUpcoming: string
  allDay: string
  details: string
  close: string
  when: string
  where: string
  summary: string
  notes: string
  links: string
  openLink: string
  linkCount: (count: number) => string
  notesReady: string
  emptyTitle: string
  emptyBody: string
  adminEyebrow: string
  adminTitle: string
  adminDescription: string
  localeLabel: string
  categoryLabel: string
  dataLabel: string
  importJson: string
  importIcs: string
  showAll: string
  viewerLink: string
  manageEvents: string
  eventLibrary: string
  createNewEvent: string
  createEvent: string
  editEvent: string
  saveChanges: string
  deleteEvent: string
  titleLabel: string
  categoryIdLabel: string
  categoryNameLabel: string
  categoryColorLabel: string
  startDateLabel: string
  startTimeLabel: string
  endDateLabel: string
  endTimeLabel: string
  allDayLabel: string
  locationLabel: string
  descriptionLabel: string
  notesLabel: string
  linksLabel: string
  addLink: string
  linkLabel: string
  linkUrl: string
  previewImageLabel: string
  previewAltLabel: string
  noEventsYet: string
  saveErrorTitle: string
  saveErrorRange: string
  deleteConfirm: string
  visibleSummary: (visible: number, total: number) => string
  landingTitle: string
  landingDesc: string
  landingSubmit: string
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
    viewerDescription: '精簡、乾淨的個人イベンターノート行程看板。',
    managedHint: '語言與分類顯示由 /admin 管理。',
    timeline: '時間軸',
    agenda: '日程列表',
    darkMode: '深色模式',
    lightMode: '亮色模式',
    nextEvent: '下一個事件',
    noUpcoming: '目前顯示範圍內沒有即將到來的事件。',
    allDay: '全天',
    details: '事件詳情',
    close: '關閉',
    when: '時間',
    where: '地點',
    summary: '出演者',
    notes: '備註',
    links: '連結',
    openLink: '打開連結',
    linkCount: (count) => `${count} 個連結`,
    notesReady: '含備註',
    emptyTitle: '這個顯示範圍內沒有行程。',
    emptyBody: '請到 /admin 調整語言、分類或重新匯入資料。',
    adminEyebrow: '後台控制',
    adminTitle: 'Eventernote Dashboard — Admin',
    adminDescription: '在這裡管理語言、顯示分類、匯入與事件資料；前端 viewer 只負責展示。',
    localeLabel: '語言',
    categoryLabel: '顯示分類',
    dataLabel: '資料',
    importJson: '匯入 JSON',
    importIcs: '匯入 ICS',
    showAll: '顯示全部',
    viewerLink: '前台',
    manageEvents: '事件管理',
    eventLibrary: '行程列表',
    createNewEvent: '新增行程',
    createEvent: '建立行程',
    editEvent: '編輯行程',
    saveChanges: '儲存變更',
    deleteEvent: '刪除行程',
    titleLabel: '活動名稱',
    categoryIdLabel: '分類 ID',
    categoryNameLabel: '分類名稱',
    categoryColorLabel: '分類顏色',
    startDateLabel: '開始日期',
    startTimeLabel: '開始時間',
    endDateLabel: '結束日期',
    endTimeLabel: '結束時間',
    allDayLabel: '全天事件',
    locationLabel: '地點',
    descriptionLabel: '簡介',
    notesLabel: '備註',
    linksLabel: '連結',
    addLink: '新增連結',
    linkLabel: '連結名稱',
    linkUrl: '連結網址',
    previewImageLabel: '預覽圖片網址',
    previewAltLabel: '圖片替代文字',
    noEventsYet: '目前還沒有行程，先新增一筆。',
    saveErrorTitle: '請填寫活動名稱。',
    saveErrorRange: '請確認開始與結束時間。',
    deleteConfirm: '確定要刪除這筆行程嗎？',
    visibleSummary: (visible, total) => `目前顯示 ${visible} / ${total}`,
    landingTitle: '活動列表',
    landingDesc: '輸入 Eventernote 用戶 ID，即可一覽參加活動。',
    landingSubmit: '查看',
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
    viewerDescription: 'A minimal personal Eventernote event viewer.',
    managedHint: 'Language and category visibility are managed from /admin.',
    timeline: 'Timeline',
    agenda: 'Agenda',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    nextEvent: 'Next event',
    noUpcoming: 'No upcoming events in the current range.',
    allDay: 'All day',
    details: 'Event details',
    close: 'Close',
    when: 'When',
    where: 'Where',
    summary: 'Performers',
    notes: 'Notes',
    links: 'Links',
    openLink: 'Open link',
    linkCount: (count) => `${count} link${count === 1 ? '' : 's'}`,
    notesReady: 'Notes ready',
    emptyTitle: 'No events are visible in this range.',
    emptyBody: 'Use /admin to change language, category visibility, or import another schedule.',
    adminEyebrow: 'Admin controls',
    adminTitle: 'Eventernote Dashboard — Admin',
    adminDescription: 'Manage language, visible categories, imports, and event data here while the viewer stays minimal.',
    localeLabel: 'Language',
    categoryLabel: 'Visible categories',
    dataLabel: 'Data',
    importJson: 'Import JSON',
    importIcs: 'Import ICS',
    showAll: 'Show all',
    viewerLink: 'Viewer',
    manageEvents: 'Event editor',
    eventLibrary: 'Event list',
    createNewEvent: 'New event',
    createEvent: 'Create event',
    editEvent: 'Edit event',
    saveChanges: 'Save changes',
    deleteEvent: 'Delete event',
    titleLabel: 'Title',
    categoryIdLabel: 'Category ID',
    categoryNameLabel: 'Category name',
    categoryColorLabel: 'Category color',
    startDateLabel: 'Start date',
    startTimeLabel: 'Start time',
    endDateLabel: 'End date',
    endTimeLabel: 'End time',
    allDayLabel: 'All-day event',
    locationLabel: 'Location',
    descriptionLabel: 'Summary',
    notesLabel: 'Notes',
    linksLabel: 'Links',
    addLink: 'Add link',
    linkLabel: 'Link label',
    linkUrl: 'Link URL',
    previewImageLabel: 'Preview image URL',
    previewAltLabel: 'Preview alt text',
    noEventsYet: 'No events yet. Create one to get started.',
    saveErrorTitle: 'Enter an event title.',
    saveErrorRange: 'Check the event start and end time.',
    deleteConfirm: 'Delete this event?',
    visibleSummary: (visible, total) => `Visible ${visible} / ${total}`,
    landingTitle: 'Event Schedule',
    landingDesc: 'Enter an Eventernote user ID to browse your event schedule.',
    landingSubmit: 'View',
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
    viewerDescription: 'イベンターノートの参加イベントを管理する軽量スケジュールビューアです。',
    managedHint: '言語とカテゴリ表示は /admin で管理します。',
    timeline: 'タイムライン',
    agenda: '日程一覧',
    darkMode: 'ダークモード',
    lightMode: 'ライトモード',
    nextEvent: '次のイベント',
    noUpcoming: '現在の表示範囲に予定はありません。',
    allDay: '終日',
    details: 'イベント詳細',
    close: '閉じる',
    when: '時間',
    where: '場所',
    summary: '出演者',
    notes: 'メモ',
    links: 'リンク',
    openLink: 'リンクを開く',
    linkCount: (count) => `リンク ${count} 件`,
    notesReady: 'メモあり',
    emptyTitle: 'この表示範囲には予定がありません。',
    emptyBody: '/admin で言語、カテゴリ、またはデータの読み込みを変更してください。',
    adminEyebrow: '管理画面',
    adminTitle: 'Eventernote Dashboard — Admin',
    adminDescription: '言語、表示カテゴリ、データ読み込み、イベント編集をここで管理し、viewer 側は表示専用にします。',
    localeLabel: '言語',
    categoryLabel: '表示カテゴリ',
    dataLabel: 'データ',
    importJson: 'JSON 読み込み',
    importIcs: 'ICS 読み込み',
    showAll: 'すべて表示',
    viewerLink: 'Viewer',
    manageEvents: 'イベント編集',
    eventLibrary: 'イベント一覧',
    createNewEvent: '新規イベント',
    createEvent: 'イベント作成',
    editEvent: 'イベント編集',
    saveChanges: '変更を保存',
    deleteEvent: 'イベント削除',
    titleLabel: 'タイトル',
    categoryIdLabel: 'カテゴリ ID',
    categoryNameLabel: 'カテゴリ名',
    categoryColorLabel: 'カテゴリ色',
    startDateLabel: '開始日',
    startTimeLabel: '開始時刻',
    endDateLabel: '終了日',
    endTimeLabel: '終了時刻',
    allDayLabel: '終日イベント',
    locationLabel: '場所',
    descriptionLabel: '概要',
    notesLabel: 'メモ',
    linksLabel: 'リンク',
    addLink: 'リンク追加',
    linkLabel: 'リンク名',
    linkUrl: 'リンク URL',
    previewImageLabel: 'プレビュー画像 URL',
    previewAltLabel: '画像代替テキスト',
    noEventsYet: 'まだイベントがありません。まず 1 件追加してください。',
    saveErrorTitle: 'イベント名を入力してください。',
    saveErrorRange: '開始時刻と終了時刻を確認してください。',
    deleteConfirm: 'このイベントを削除しますか？',
    visibleSummary: (visible, total) => `${visible} / ${total} 件を表示中`,
    landingTitle: 'イベント一覧',
    landingDesc: 'Eventernote のユーザー ID を入力すると、参加イベントを一覧表示します。',
    landingSubmit: '表示する',
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
  allYears: string
  attendedEvents: string
  venues: string
  regions: string
  artists: string
  ticketSpend: string
  ticketCoverage: (priced: number, total: number) => string
  venueRanking: string
  regionBreakdown: string
  artistRanking: string
  activityByMonth: string
  venueMap: string
  openMap: string
  mapHint: string
  mapCoverage: (mapped: number, total: number) => string
  eventOccurrences: (count: number) => string
  approximateLocation: string
  expandEvents: (name: string, count: number) => string
  ticketLedger: string
  ticketLedgerHint: string
  ticketPrice: string
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
  localOnly: string
}

const REPORT_COPY: Record<SupportedLocale, ReportCopy> = {
  'zh-Hant': {
    landingTitle: '活動統計報告',
    landingDesc: '按年份整理會場、地區、藝人與門票花費。',
    landingSubmit: '產出報告',
    eyebrow: 'Attendance report',
    title: (userId) => `${userId} 的活動足跡`,
    subtitle: '把去過的現場，整理成一份值得回看的紀錄。',
    back: '返回活動列表',
    refresh: '重新整理資料',
    allYears: '所有年份',
    attendedEvents: '參加活動',
    venues: '去過會場',
    regions: '足跡地區',
    artists: '看過藝人',
    ticketSpend: '門票花費',
    ticketCoverage: (priced, total) => `已填 ${priced} / ${total} 場`,
    venueRanking: '最常去的會場',
    regionBreakdown: '活動地區',
    artistRanking: '最常看的藝人',
    activityByMonth: '月份分布',
    venueMap: '會場地圖',
    openMap: '在地圖開啟',
    mapHint: '目前統計範圍內的會場會同時標記在地圖上。',
    mapCoverage: (mapped, total) => `已標記 ${mapped} / ${total} 個會場`,
    eventOccurrences: (count) => `${count} 場活動`,
    approximateLocation: '城市級約略位置',
    expandEvents: (name, count) => `展開 ${name} 的 ${count} 場活動`,
    ticketLedger: '門票紀錄',
    ticketLedgerHint: 'Eventernote 不提供票價；你補登的金額只會存在這個瀏覽器。',
    ticketPrice: '票價',
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
    localOnly: '僅儲存在此裝置',
  },
  en: {
    landingTitle: 'Attendance report',
    landingDesc: 'Explore venues, regions, artists, and ticket spend by year.',
    landingSubmit: 'Create report',
    eyebrow: 'Attendance report',
    title: (userId) => `${userId}'s live event footprint`,
    subtitle: 'A personal record of the live events you have attended.',
    back: 'Back to events',
    refresh: 'Refresh data',
    allYears: 'All years',
    attendedEvents: 'Events attended',
    venues: 'Venues visited',
    regions: 'Regions visited',
    artists: 'Artists seen',
    ticketSpend: 'Ticket spend',
    ticketCoverage: (priced, total) => `${priced} of ${total} events entered`,
    venueRanking: 'Most visited venues',
    regionBreakdown: 'Event regions',
    artistRanking: 'Most seen artists',
    activityByMonth: 'Events by month',
    venueMap: 'Venue map',
    openMap: 'Open in maps',
    mapHint: 'All venues in the current report range are shown together.',
    mapCoverage: (mapped, total) => `${mapped} of ${total} venues mapped`,
    eventOccurrences: (count) => `${count} event${count === 1 ? '' : 's'}`,
    approximateLocation: 'Approximate city location',
    expandEvents: (name, count) => `Show ${count} events for ${name}`,
    ticketLedger: 'Ticket ledger',
    ticketLedgerHint: 'Eventernote does not provide prices. Entries are stored only in this browser.',
    ticketPrice: 'Ticket price',
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
    localOnly: 'Stored on this device only',
  },
  ja: {
    landingTitle: 'イベント統計レポート',
    landingDesc: '会場・地域・出演者・チケット代を年ごとに集計します。',
    landingSubmit: 'レポートを作る',
    eyebrow: 'Attendance report',
    title: (userId) => `${userId}さんのイベント記録`,
    subtitle: '参加した現場を、振り返りたくなるレポートに。',
    back: 'イベント一覧へ',
    refresh: 'データを更新',
    allYears: 'すべての年',
    attendedEvents: '参加イベント',
    venues: '訪れた会場',
    regions: '訪れた地域',
    artists: '見た出演者',
    ticketSpend: 'チケット代',
    ticketCoverage: (priced, total) => `${priced} / ${total} 件入力済み`,
    venueRanking: 'よく行く会場',
    regionBreakdown: '開催地域',
    artistRanking: 'よく見る出演者',
    activityByMonth: '月別イベント数',
    venueMap: '会場マップ',
    openMap: '地図で開く',
    mapHint: '現在の集計範囲にあるすべての会場を表示します。',
    mapCoverage: (mapped, total) => `${mapped} / ${total} 会場を表示`,
    eventOccurrences: (count) => `${count} 件のイベント`,
    approximateLocation: '都市単位の概算位置',
    expandEvents: (name, count) => `${name}のイベント ${count} 件を表示`,
    ticketLedger: 'チケット記録',
    ticketLedgerHint: 'Eventernote に価格情報はありません。入力内容はこのブラウザだけに保存されます。',
    ticketPrice: 'チケット代',
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
    localOnly: 'この端末にのみ保存',
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
