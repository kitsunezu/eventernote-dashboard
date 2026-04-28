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
    summary: 'Summary',
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
    summary: '概要',
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
  },
}

export function getUiCopy(locale: SupportedLocale): UiCopy {
  return UI_COPY[locale]
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