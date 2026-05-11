import { useEffect, useRef, useState } from 'react'
import { DAY_RANGE_OPTIONS, type DayRangeOption, type SupportedLocale, type ThemeMode } from '../types/events'
import { formatDayRangeOption, getUiCopy } from '../lib/localize'
import { ChevronDownIcon, MoonIcon, SunIcon } from './Icons'

interface HeaderProps {
  locale: SupportedLocale
  theme: ThemeMode
  daysToShow: DayRangeOption
  cachedAt?: string
  loading?: boolean
  onThemeToggle: () => void
  onDaysToShowChange: (daysToShow: DayRangeOption) => void
  onRefresh?: () => void
}

export function Header({
  locale,
  theme,
  daysToShow,
  cachedAt,
  loading,
  onThemeToggle,
  onDaysToShowChange,
  onRefresh,
}: HeaderProps) {
  const copy = getUiCopy(locale)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [, tick] = useState(0)

  // Re-render every minute so "X min ago" stays accurate
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
  }

  const minutesAgo = cachedAt
    ? Math.floor((Date.now() - new Date(cachedAt).getTime()) / 60_000)
    : null

  return (
    <aside className="app-header" aria-label={copy.viewerTitle}>
      {/* custom range picker */}
      <div className="ctrl-dropdown" ref={wrapRef} onKeyDown={handleKeyDown}>
        <button
          className="ctrl-dropdown__trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Schedule range"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ctrl-dropdown__label">{formatDayRangeOption(locale, daysToShow)}</span>
          <ChevronDownIcon className={`ui-icon ctrl-dropdown__caret${open ? ' is-open' : ''}`} />
        </button>

        {open && (
          <ul className="ctrl-dropdown__menu" role="listbox" aria-label="Schedule range">
            {DAY_RANGE_OPTIONS.map((option) => (
              <li
                key={option}
                role="option"
                aria-selected={option === daysToShow}
                className={`ctrl-dropdown__item${option === daysToShow ? ' is-active' : ''}`}
                tabIndex={0}
                onClick={() => {
                  onDaysToShowChange(option)
                  setOpen(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onDaysToShowChange(option)
                    setOpen(false)
                  }
                }}
              >
                {formatDayRangeOption(locale, option)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* refresh button + last-updated hint */}
      {onRefresh && (
        <div className="header-refresh">
          {minutesAgo !== null && !loading && (
            <span className="header-refresh__label">
              {copy.lastUpdated(minutesAgo)}
            </span>
          )}
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
