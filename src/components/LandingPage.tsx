import { useEffect, useState } from 'react'
import { BarChart3, CalendarDays } from 'lucide-react'
import { searchEventernoteActors } from '../adapters/eventernoteApiSource'
import type { ActorSuggestion } from '../adapters/eventernoteApiSource'
import type { SupportedLocale, ThemeMode } from '../types/events'
import { LOCALE_LABELS, SUPPORTED_LOCALES, getReportCopy, getUiCopy } from '../lib/localize'
import { MoonIcon, SunIcon } from './Icons'

type LandingMode = 'users' | 'actors'

interface LandingPageProps {
  theme: ThemeMode
  locale: SupportedLocale
  initialMode?: LandingMode
  onThemeToggle: () => void
  onLocaleChange: (locale: SupportedLocale) => void
}

export function LandingPage({
  theme,
  locale,
  initialMode = 'users',
  onThemeToggle,
  onLocaleChange,
}: LandingPageProps) {
  const [mode, setMode] = useState<LandingMode>(initialMode)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([])
  const [selectedActor, setSelectedActor] = useState<ActorSuggestion | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const copy = getUiCopy(locale)
  const reportCopy = getReportCopy(locale)

  useEffect(() => {
    if (mode !== 'actors' || query.trim().length === 0 || selectedActor?.name === query) {
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      setSearchError(false)
      void searchEventernoteActors(query.trim(), controller.signal)
        .then(setSuggestions)
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setSuggestions([])
          setSearchError(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [mode, query, selectedActor])

  function switchMode() {
    setMode((current) => current === 'users' ? 'actors' : 'users')
    setQuery('')
    setSuggestions([])
    setSelectedActor(null)
    setSearching(false)
    setSearchError(false)
  }

  function openActor(actor: ActorSuggestion) {
    window.location.href = `/actors/${encodeURIComponent(actor.name)}/${actor.id}`
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'actors') {
      const actor = selectedActor ?? suggestions[0]
      if (actor) openActor(actor)
      return
    }
    const id = query.trim()
    if (id) window.location.href = `/users/${encodeURIComponent(id)}`
  }

  function openReport() {
    if (mode === 'actors') {
      const actor = selectedActor ?? suggestions[0]
      if (actor) {
        window.location.href = `/report/actors/${encodeURIComponent(actor.name)}/${actor.id}`
      }
      return
    }
    const id = query.trim()
    if (id) window.location.href = `/report/${encodeURIComponent(id)}`
  }

  function selectActor(actor: ActorSuggestion) {
    setSelectedActor(actor)
    setQuery(actor.name)
    setSuggestions([])
  }

  const canSubmit = mode === 'users' ? Boolean(query.trim()) : Boolean(selectedActor ?? suggestions[0])
  const showSuggestions = mode === 'actors'
    && query.trim().length > 0
    && (searching || searchError || suggestions.length > 0 || (!selectedActor && !searching))

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
          {theme === 'dark' ? <SunIcon className="ui-icon" /> : <MoonIcon className="ui-icon" />}
        </button>
      </div>

      <div className="landing-card">
        <p className="landing-eyebrow">{copy.viewerEyebrow}</p>
        <h1 className="landing-title">{copy.landingTitle}</h1>
        <p className="landing-desc">{mode === 'actors' ? copy.actorLandingDesc : copy.landingDesc}</p>

        <form onSubmit={handleSubmit} className="landing-form">
          <div className="landing-search">
            <div className="landing-input-wrap">
              <span className="landing-input-prefix">
                eventernote.com/
                <button type="button" className="landing-mode-toggle" onClick={switchMode}>
                  {mode}/
                </button>
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  const value = e.target.value
                  setQuery(value)
                  setSelectedActor(null)
                  setSuggestions([])
                  setSearching(mode === 'actors' && Boolean(value.trim()))
                  setSearchError(false)
                }}
                placeholder={mode === 'actors' ? copy.actorSearchPlaceholder : 'userId'}
                className="landing-input"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                role={mode === 'actors' ? 'combobox' : undefined}
                aria-autocomplete={mode === 'actors' ? 'list' : undefined}
                aria-expanded={mode === 'actors' ? showSuggestions : undefined}
                aria-controls={mode === 'actors' ? 'actor-suggestions' : undefined}
              />
            </div>

            {showSuggestions && (
              <div className="landing-suggestions" id="actor-suggestions" role="listbox">
                {searching ? (
                  <p className="landing-suggestions__status">{copy.actorSearchLoading}</p>
                ) : searchError ? (
                  <p className="landing-suggestions__status">{copy.actorSearchError}</p>
                ) : suggestions.length === 0 ? (
                  <p className="landing-suggestions__status">{copy.actorSearchEmpty}</p>
                ) : suggestions.map((actor) => (
                  <button
                    key={actor.id}
                    type="button"
                    className="landing-suggestion"
                    role="option"
                    aria-selected={selectedActor?.id === actor.id}
                    onClick={() => selectActor(actor)}
                  >
                    <strong>{actor.name}</strong>
                    {actor.kana && <small>{actor.kana}</small>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="landing-actions">
            <button type="submit" className="landing-btn" disabled={!canSubmit}>
              <CalendarDays size={17} />
              <span><strong>{copy.landingSubmit}</strong><small>{copy.landingTitle}</small></span>
            </button>
            <button type="button" className="landing-btn landing-btn--report" disabled={!canSubmit} onClick={openReport}>
              <BarChart3 size={17} />
              <span><strong>{reportCopy.landingSubmit}</strong><small>{reportCopy.landingTitle}</small></span>
            </button>
          </div>
          <p className="landing-report-hint">{reportCopy.landingDesc}</p>
        </form>
      </div>
    </div>
  )
}
