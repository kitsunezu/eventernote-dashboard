import { useEffect } from 'react'
import { Countdown } from './components/Countdown'
import { EventDetailsDrawer } from './components/EventDetailsDrawer'
import { Header } from './components/Header'
import { LandingPage } from './components/LandingPage'
import { TimelineView } from './components/TimelineView'
import {
  selectNextEvent,
  selectSelectedEvent,
  selectVisibleEvents,
  useScheduleStore,
} from './store/useScheduleStore'

function App() {
  // Derive userId from URL path: "/slan1024" → "slan1024", "/" → null
  const pathname = window.location.pathname
  const userId =
    pathname === '/' ? null : pathname.replace(/^\/+/, '').split('/')[0] || null

  const state = useScheduleStore()
  const visibleEvents = selectVisibleEvents(state)
  const nextEvent = selectNextEvent(state)
  const selectedEvent = selectSelectedEvent(state)

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document.documentElement.style.colorScheme = state.theme
  }, [state.theme])

  useEffect(() => {
    if (userId) {
      state.loadFromEventernote(userId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (!userId) {
    return <LandingPage theme={state.theme} onThemeToggle={state.toggleTheme} />
  }

  return (
    <div className="app-shell-root">
      <div className="app-shell app-shell--viewer">
        <Header
          locale={state.locale}
          theme={state.theme}
          daysToShow={state.daysToShow}
          onThemeToggle={state.toggleTheme}
          onDaysToShowChange={state.setDaysToShow}
        />

        <main className="viewer-layout">
          {state.loading ? (
            <div className="loading-state" aria-live="polite">
              <span className="loading-spinner" aria-hidden="true" />
              <p>読み込み中…</p>
            </div>
          ) : state.error ? (
            <div className="error-state" role="alert">
              <p className="error-state__title">読み込みエラー</p>
              <p className="error-state__body">{state.error}</p>
              <button
                type="button"
                className="error-state__retry"
                onClick={() => state.loadFromEventernote(userId)}
              >
                再試行
              </button>
            </div>
          ) : (
            <>
              <Countdown locale={state.locale} nextEvent={nextEvent} />

              <div className="schedule-canvas">
                {visibleEvents.length === 0 ? (
                  <section className="empty-state" aria-live="polite">
                    <h2>イベントなし</h2>
                    <p>表示できるイベントがありません。</p>
                  </section>
                ) : (
                  <TimelineView
                    events={visibleEvents}
                    locale={state.locale}
                    onOpenEvent={state.selectEvent}
                  />
                )}
              </div>
            </>
          )}
        </main>

        <EventDetailsDrawer
          event={selectedEvent}
          locale={state.locale}
          onClose={() => state.selectEvent(null)}
        />
      </div>
    </div>
  )
}

export default App
