import type {
  DayRangeOption,
  SupportedLocale,
  ThemeMode,
  TimelineImageLayout,
  ViewMode,
} from '../types/events'
import { formatDayRangeOption, getUiCopy } from '../lib/localize'
import { CalendarIcon, ImageIcon, ListIcon, MoonIcon, SunIcon } from './Icons'

interface HeaderProps {
  locale: SupportedLocale
  theme: ThemeMode
  viewMode: ViewMode
  timelineImageLayout: TimelineImageLayout
  daysToShow: DayRangeOption
  loading?: boolean
  onThemeToggle: () => void
  onViewModeChange: (viewMode: ViewMode) => void
  onTimelineImageLayoutChange: (layout: TimelineImageLayout) => void
  onDaysToShowChange: (daysToShow: DayRangeOption) => void
  onRefresh?: () => void
}

export function Header({
  locale,
  theme,
  viewMode,
  timelineImageLayout,
  daysToShow,
  loading,
  onThemeToggle,
  onViewModeChange,
  onTimelineImageLayoutChange,
  onDaysToShowChange,
  onRefresh,
}: HeaderProps) {
  const copy = getUiCopy(locale)
  const calendarActive = viewMode === 'calendar'
  const displayedDaysToShow = calendarActive ? 'all' : daysToShow
  const nextDaysToShow = displayedDaysToShow === 'all' ? 'future' : 'all'
  const viewToggleLabel = calendarActive ? copy.showTimeline : copy.showCalendar
  const backgroundImagesActive = timelineImageLayout === 'background'
  const imageLayoutToggleLabel = backgroundImagesActive
    ? copy.showSideImages
    : copy.showBackgroundImages

  return (
    <aside className="app-header" aria-label={copy.viewerTitle}>
      <button
        className={`ctrl-range-toggle${displayedDaysToShow === 'all' ? ' is-active' : ''}`}
        type="button"
        aria-label={formatDayRangeOption(locale, 'all')}
        aria-pressed={displayedDaysToShow === 'all'}
        title={formatDayRangeOption(locale, nextDaysToShow)}
        disabled={calendarActive}
        onClick={() => onDaysToShowChange(nextDaysToShow)}
      >
        {formatDayRangeOption(locale, displayedDaysToShow)}
      </button>

      {/* refresh button */}
      {onRefresh && (
        <div className="header-refresh">
          <button
            className="button button--ghost icon-button"
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={loading ? copy.refreshing : copy.refreshData}
            title={loading ? copy.refreshing : copy.refreshData}
          >
            <RefreshIcon className={`ui-icon${loading ? ' is-spinning' : ''}`} />
          </button>
        </div>
      )}

      <button
        className={`button button--ghost icon-button${calendarActive ? ' is-active' : ''}`}
        type="button"
        onClick={() => onViewModeChange(calendarActive ? 'timeline' : 'calendar')}
        aria-label={viewToggleLabel}
        aria-pressed={calendarActive}
        title={viewToggleLabel}
      >
        {calendarActive ? <ListIcon className="ui-icon" /> : <CalendarIcon className="ui-icon" />}
        <span className="visually-hidden">{viewToggleLabel}</span>
      </button>

      {!calendarActive ? (
        <button
          className={`button button--ghost icon-button${backgroundImagesActive ? ' is-active' : ''}`}
          type="button"
          onClick={() => onTimelineImageLayoutChange(backgroundImagesActive ? 'thumbnail' : 'background')}
          aria-label={imageLayoutToggleLabel}
          aria-pressed={backgroundImagesActive}
          title={imageLayoutToggleLabel}
        >
          <ImageIcon className="ui-icon" />
          <span className="visually-hidden">{imageLayoutToggleLabel}</span>
        </button>
      ) : null}

      {/* theme toggle */}
      <button
        className="button button--ghost icon-button"
        type="button"
        onClick={onThemeToggle}
        aria-label={theme === 'dark' ? copy.lightMode : copy.darkMode}
        title={theme === 'dark' ? copy.lightMode : copy.darkMode}
      >
        {theme === 'dark' ? <SunIcon className="ui-icon" /> : <MoonIcon className="ui-icon" />}
        <span className="visually-hidden">{theme === 'dark' ? copy.lightMode : copy.darkMode}</span>
      </button>
    </aside>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  )
}
