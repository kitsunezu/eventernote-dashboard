import { useEffect, useRef, useState } from 'react'
import { DAY_RANGE_OPTIONS, type DayRangeOption, type SupportedLocale, type ThemeMode } from '../types/events'
import { formatDayRangeOption, getUiCopy } from '../lib/localize'
import { ChevronDownIcon, MoonIcon, SunIcon } from './Icons'

interface HeaderProps {
  locale: SupportedLocale
  theme: ThemeMode
  daysToShow: DayRangeOption
  onThemeToggle: () => void
  onDaysToShowChange: (daysToShow: DayRangeOption) => void
}

export function Header({
  locale,
  theme,
  daysToShow,
  onThemeToggle,
  onDaysToShowChange,
}: HeaderProps) {
  const copy = getUiCopy(locale)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

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