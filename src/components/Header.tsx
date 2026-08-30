import { useEffect, useState } from 'react'
import { Settings, Ticket, X } from 'lucide-react'
import type {
  CountdownStyle,
  DayRangeOption,
  SupportedLocale,
  ThemeMode,
  TimelineImageLayout,
  ViewMode,
} from '../types/events'
import { formatDayRangeOption, getUiCopy, LOCALE_LABELS, SUPPORTED_LOCALES } from '../lib/localize'
import { CalendarIcon, ImageIcon, ListIcon, MoonIcon, SunIcon } from './Icons'

interface HeaderProps {
  locale: SupportedLocale
  theme: ThemeMode
  viewMode: ViewMode
  timelineImageLayout: TimelineImageLayout
  countdownStyle: CountdownStyle
  daysToShow: DayRangeOption
  loading?: boolean
  onThemeToggle: () => void
  onViewModeChange: (viewMode: ViewMode) => void
  onTimelineImageLayoutChange: (layout: TimelineImageLayout) => void
  onCountdownStyleChange: (style: CountdownStyle) => void
  onDaysToShowChange: (daysToShow: DayRangeOption) => void
  onLocaleChange: (locale: SupportedLocale) => void
  onRefresh?: () => void
}

export function Header({
  locale,
  theme,
  viewMode,
  timelineImageLayout,
  countdownStyle,
  daysToShow,
  loading,
  onThemeToggle,
  onViewModeChange,
  onTimelineImageLayoutChange,
  onCountdownStyleChange,
  onDaysToShowChange,
  onLocaleChange,
  onRefresh,
}: HeaderProps) {
  const copy = getUiCopy(locale)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const calendarActive = viewMode === 'calendar'
  const displayedDaysToShow = calendarActive ? 'all' : daysToShow
  const nextDaysToShow = displayedDaysToShow === 'all' ? 'future' : 'all'
  const viewToggleLabel = calendarActive ? copy.showTimeline : copy.showCalendar
  const backgroundImagesActive = timelineImageLayout === 'background'
  const imageLayoutToggleLabel = backgroundImagesActive
    ? copy.showSideImages
    : copy.showBackgroundImages
  const ticketCountdownActive = countdownStyle === 'ticket'
  const countdownStyleToggleLabel = ticketCountdownActive
    ? copy.useClassicCountdown
    : copy.useTicketCountdown
  const languageDescription = copy.languageDescription(LOCALE_LABELS[locale])

  useEffect(() => {
    if (!settingsOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settingsOpen])

  return (
    <>
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

        <button
          className="button button--ghost icon-button"
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-label={copy.settings}
          aria-expanded={settingsOpen}
          aria-controls="viewer-settings-dialog"
          title={copy.settings}
        >
          <Settings className="ui-icon" aria-hidden="true" />
          <span className="visually-hidden">{copy.settings}</span>
        </button>

      </aside>

      {settingsOpen && (
        <div className="settings-modal">
          <button
            type="button"
            className="settings-modal__scrim"
            aria-label={copy.close}
            onClick={() => setSettingsOpen(false)}
          />
          <section
            id="viewer-settings-dialog"
            className="settings-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="viewer-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="settings-modal__header">
              <h2 id="viewer-settings-title">{copy.settingsTitle}</h2>
              <button
                type="button"
                className="button button--ghost icon-button settings-modal__close"
                aria-label={copy.close}
                title={copy.close}
                onClick={() => setSettingsOpen(false)}
                autoFocus
              >
                <X className="ui-icon" aria-hidden="true" />
              </button>
            </header>

            <div className="settings-modal__options">
              {onRefresh && (
                <div className="settings-option">
                  <div className="settings-option__copy">
                    <strong>{copy.refreshData}</strong>
                    <span>{copy.refreshDescription}</span>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost icon-button settings-option__button"
                    onClick={onRefresh}
                    disabled={loading}
                    aria-label={loading ? copy.refreshing : copy.refreshData}
                    title={loading ? copy.refreshing : copy.refreshData}
                  >
                    <RefreshIcon className={`ui-icon${loading ? ' is-spinning' : ''}`} />
                  </button>
                </div>
              )}

              {!calendarActive && (
                <div className="settings-option">
                  <div className="settings-option__copy">
                    <strong>{copy.imageStyle}</strong>
                    <span>{imageLayoutToggleLabel}</span>
                  </div>
                  <button
                    type="button"
                    className={`button button--ghost icon-button settings-option__button${backgroundImagesActive ? ' is-active' : ''}`}
                    onClick={() => onTimelineImageLayoutChange(backgroundImagesActive ? 'thumbnail' : 'background')}
                    aria-label={imageLayoutToggleLabel}
                    aria-pressed={backgroundImagesActive}
                    title={imageLayoutToggleLabel}
                  >
                    <ImageIcon className="ui-icon" />
                  </button>
                </div>
              )}

              <div className="settings-option">
                <div className="settings-option__copy">
                  <strong>{copy.countdownStyle}</strong>
                  <span>{countdownStyleToggleLabel}</span>
                </div>
                <button
                  type="button"
                  className={`button button--ghost icon-button settings-option__button${ticketCountdownActive ? ' is-active' : ''}`}
                  onClick={() => onCountdownStyleChange(ticketCountdownActive ? 'classic' : 'ticket')}
                  aria-label={countdownStyleToggleLabel}
                  aria-pressed={ticketCountdownActive}
                  title={countdownStyleToggleLabel}
                >
                  <Ticket className="ui-icon" aria-hidden="true" />
                </button>
              </div>

              <div className="settings-option">
                <div className="settings-option__copy">
                  <strong>{copy.themeMode}</strong>
                  <span>{theme === 'dark' ? copy.lightMode : copy.darkMode}</span>
                </div>
                <button
                  type="button"
                  className="button button--ghost icon-button settings-option__button"
                  onClick={onThemeToggle}
                  aria-label={theme === 'dark' ? copy.lightMode : copy.darkMode}
                  title={theme === 'dark' ? copy.lightMode : copy.darkMode}
                >
                  {theme === 'dark' ? <SunIcon className="ui-icon" /> : <MoonIcon className="ui-icon" />}
                </button>
              </div>

              <div className="settings-option">
                <div className="settings-option__copy">
                  <strong>{copy.language}</strong>
                  <span>{languageDescription}</span>
                </div>
                <div className="landing-locale-switcher" role="group" aria-label={copy.language}>
                  {SUPPORTED_LOCALES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`landing-locale-btn${option === locale ? ' is-active' : ''}`}
                      onClick={() => onLocaleChange(option)}
                      aria-pressed={option === locale}
                    >
                      {LOCALE_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
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
