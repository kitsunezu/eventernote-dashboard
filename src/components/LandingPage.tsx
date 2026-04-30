import { useState } from 'react'
import type { SupportedLocale, ThemeMode } from '../types/events'
import { LOCALE_LABELS, SUPPORTED_LOCALES, getUiCopy } from '../lib/localize'
import { MoonIcon, SunIcon } from './Icons'

interface LandingPageProps {
  theme: ThemeMode
  locale: SupportedLocale
  onThemeToggle: () => void
  onLocaleChange: (locale: SupportedLocale) => void
}

export function LandingPage({ theme, locale, onThemeToggle, onLocaleChange }: LandingPageProps) {
  const [userId, setUserId] = useState('')
  const copy = getUiCopy(locale)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = userId.trim()
    if (id) {
      window.location.href = `/${id}`
    }
  }

  return (
    <div className="landing-root">
      <div className="landing-top-bar">
        <div className="landing-locale-switcher">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              className={`landing-locale-btn${l === locale ? ' is-active' : ''}`}
              onClick={() => onLocaleChange(l)}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="landing-theme-btn"
          onClick={onThemeToggle}
          aria-label={theme === 'dark' ? copy.lightMode : copy.darkMode}
        >
          {theme === 'dark' ? (
            <SunIcon className="ui-icon" />
          ) : (
            <MoonIcon className="ui-icon" />
          )}
        </button>
      </div>

      <div className="landing-card">
        <p className="landing-eyebrow">{copy.viewerEyebrow}</p>
        <h1 className="landing-title">{copy.landingTitle}</h1>
        <p className="landing-desc">{copy.landingDesc}</p>

        <form onSubmit={handleSubmit} className="landing-form">
          <div className="landing-input-wrap">
            <span className="landing-input-prefix">eventernote.com/users/</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="userId"
              className="landing-input"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            className="landing-btn"
            disabled={!userId.trim()}
          >
            {copy.landingSubmit}
          </button>
        </form>
      </div>
    </div>
  )
}
