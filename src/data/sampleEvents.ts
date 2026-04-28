import dayjs from 'dayjs'
import type { ScheduleEvent } from '../types/events'
import { colorForCategory } from '../lib/date'

function createPreviewImage(title: string, accent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#11161f" />
          <stop offset="100%" stop-color="#1b2430" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="32" fill="url(#bg)" />
      <circle cx="540" cy="72" r="72" fill="${accent}" opacity="0.24" />
      <circle cx="116" cy="302" r="92" fill="${accent}" opacity="0.18" />
      <rect x="56" y="56" width="528" height="248" rx="24" fill="#0d1219" opacity="0.38" />
      <text x="56" y="168" fill="#f3f7fb" font-family="Noto Sans, Noto Sans TC, Noto Sans JP, sans-serif" font-size="34" font-weight="600">${title}</text>
    </svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function createSampleEvents(): ScheduleEvent[] {
  const now = dayjs().startOf('day')
  const workColor = colorForCategory('work')
  const planningColor = colorForCategory('planning')
  const personalColor = colorForCategory('personal')
  const focusColor = colorForCategory('focus')
  const healthColor = colorForCategory('health')

  return [
    {
      id: 'sample-standup',
      title: 'Morning alignment',
      startAt: now.add(9, 'hour').toISOString(),
      endAt: now.add(9, 'hour').add(30, 'minute').toISOString(),
      allDay: false,
      category: {
        id: 'work',
        label: 'Work',
        color: workColor,
        labels: { 'zh-Hant': '工作', en: 'Work', ja: '仕事' },
      },
      description: 'Daily sync covering priorities and blockers.',
      notes: 'Review release tasks, open questions, and deployment timeline.',
      location: 'Focus room',
      links: [
        {
          label: 'Meeting notes',
          url: 'https://example.com/standup',
          localizedLabel: { 'zh-Hant': '會議筆記', en: 'Meeting notes', ja: '会議メモ' },
        },
      ],
      sourceType: 'sample',
      localized: {
        'zh-Hant': {
          title: '晨間對焦',
          description: '每天的優先事項與阻塞同步。',
          notes: '確認釋出項目、待解問題與部署時程。',
          location: '專注室',
        },
        en: {
          title: 'Morning alignment',
          description: 'Daily sync covering priorities and blockers.',
          notes: 'Review release tasks, open questions, and deployment timeline.',
          location: 'Focus room',
        },
        ja: {
          title: '朝のアラインメント',
          description: '優先事項とブロッカーを確認する定例同期です。',
          notes: 'リリース項目、未解決事項、デプロイ日程を確認します。',
          location: 'フォーカスルーム',
        },
      },
      previewImageUrl: createPreviewImage('Morning alignment', workColor),
      previewImageAlt: 'Abstract event preview for Morning alignment',
    },
    {
      id: 'sample-deep-work',
      title: 'Product planning block',
      startAt: now.add(1, 'day').add(13, 'hour').toISOString(),
      endAt: now.add(1, 'day').add(15, 'hour').toISOString(),
      allDay: false,
      category: {
        id: 'planning',
        label: 'Planning',
        color: planningColor,
        labels: { 'zh-Hant': '規劃', en: 'Planning', ja: '企画' },
      },
      description: 'Outline milestones for the next sprint and review incoming asks.',
      notes: 'Capture dependencies, owner assignment, and post-launch follow-up.',
      location: 'Studio desk',
      links: [
        {
          label: 'Roadmap board',
          url: 'https://example.com/roadmap',
          localizedLabel: { 'zh-Hant': '路線圖看板', en: 'Roadmap board', ja: 'ロードマップボード' },
        },
      ],
      sourceType: 'sample',
      localized: {
        'zh-Hant': {
          title: '產品規劃時段',
          description: '整理下一個 sprint 的里程碑與新需求。',
          notes: '記錄依賴、負責人與上線後追蹤項目。',
          location: '工作室桌前',
        },
        ja: {
          title: 'プロダクト計画ブロック',
          description: '次スプリントのマイルストーンと新規依頼を整理します。',
          notes: '依存関係、担当者、リリース後の確認事項をまとめます。',
          location: 'スタジオデスク',
        },
      },
      previewImageUrl: createPreviewImage('Planning block', planningColor),
      previewImageAlt: 'Abstract event preview for Product planning block',
    },
    {
      id: 'sample-dinner',
      title: 'Family dinner',
      startAt: now.add(2, 'day').add(19, 'hour').toISOString(),
      endAt: now.add(2, 'day').add(21, 'hour').toISOString(),
      allDay: false,
      category: {
        id: 'personal',
        label: 'Personal',
        color: personalColor,
        labels: { 'zh-Hant': '私人', en: 'Personal', ja: '個人' },
      },
      description: 'Offline time with family.',
      notes: 'Bring dessert and confirm reservation at 18:00.',
      location: 'North table',
      links: [],
      sourceType: 'sample',
      localized: {
        'zh-Hant': {
          title: '家庭晚餐',
          description: '和家人一起放鬆的晚餐時間。',
          notes: '記得帶甜點，18:00 前確認訂位。',
          location: '北區餐桌',
        },
        ja: {
          title: '家族ディナー',
          description: '家族とゆっくり過ごす夕食の時間です。',
          notes: 'デザートを持参し、18:00 までに予約確認。',
          location: 'ノーステーブル',
        },
      },
      previewImageUrl: createPreviewImage('Family dinner', personalColor),
      previewImageAlt: 'Abstract event preview for Family dinner',
    },
    {
      id: 'sample-focus-day',
      title: 'No meeting focus day',
      startAt: now.add(3, 'day').toISOString(),
      endAt: now.add(3, 'day').add(23, 'hour').add(59, 'minute').toISOString(),
      allDay: true,
      category: {
        id: 'focus',
        label: 'Focus',
        color: focusColor,
        labels: { 'zh-Hant': '專注', en: 'Focus', ja: '集中' },
      },
      description: 'Reserved for uninterrupted delivery work.',
      notes: 'Notifications off except emergency channel.',
      location: 'Home office',
      links: [],
      sourceType: 'sample',
      localized: {
        'zh-Hant': {
          title: '無會議專注日',
          description: '保留給不中斷的交付工作。',
          notes: '除了緊急頻道，其他通知全部關閉。',
          location: '家庭辦公室',
        },
        ja: {
          title: '会議なし集中日',
          description: '中断のない制作作業にあてる一日です。',
          notes: '緊急チャンネル以外の通知はオフにします。',
          location: 'ホームオフィス',
        },
      },
      previewImageUrl: createPreviewImage('Focus day', focusColor),
      previewImageAlt: 'Abstract event preview for No meeting focus day',
    },
    {
      id: 'sample-health',
      title: 'Trail run',
      startAt: now.add(5, 'day').add(6, 'hour').add(30, 'minute').toISOString(),
      endAt: now.add(5, 'day').add(8, 'hour').toISOString(),
      allDay: false,
      category: {
        id: 'health',
        label: 'Health',
        color: healthColor,
        labels: { 'zh-Hant': '健康', en: 'Health', ja: '健康' },
      },
      description: 'Long run to reset before the weekend.',
      notes: 'Hydration vest, route B, recovery stretch after cooldown.',
      location: 'River trail',
      links: [
        {
          label: 'Route map',
          url: 'https://example.com/trail',
          localizedLabel: { 'zh-Hant': '路線地圖', en: 'Route map', ja: 'ルートマップ' },
        },
      ],
      sourceType: 'sample',
      localized: {
        'zh-Hant': {
          title: '越野跑',
          description: '週末前重整節奏的長距離跑。',
          notes: '水袋背心、B 路線、結束後做恢復伸展。',
          location: '河岸步道',
        },
        ja: {
          title: 'トレイルラン',
          description: '週末前にリズムを整えるロングランです。',
          notes: 'ハイドレーションベスト、Bルート、終了後にストレッチ。',
          location: 'リバートレイル',
        },
      },
      previewImageUrl: createPreviewImage('Trail run', healthColor),
      previewImageAlt: 'Abstract event preview for Trail run',
    },
  ]
}