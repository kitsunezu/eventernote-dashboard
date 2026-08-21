import { useEffect } from 'react'
import { Countdown } from './components/Countdown'
import { EventDetailsDrawer } from './components/EventDetailsDrawer'
import { Header } from './components/Header'
import { LandingPage } from './components/LandingPage'
import { ReportPage } from './components/ReportPage'
import { TimelineView } from './components/TimelineView'
import { getUiCopy } from './lib/localize'
import {
  CACHE_TTL_MS,
  selectNextEvent,
  selectSelectedEvent,
  selectVisibleEvents,
  useScheduleStore,
} from './store/useScheduleStore'

function App() {
  const pathSegments = window.location.pathname.split('/').filter(Boolean)
  const isReportRoute = pathSegments[0] === 'report'
  const isActorReportRoute = isReportRoute && pathSegments[1] === 'actors'
  const isActorRoute = pathSegments[0] === 'actors' || isActorReportRoute
  const isUserRoute = pathSegments[0] === 'users'
  const actorNameSegment = isActorReportRoute ? pathSegments[2] : isActorRoute ? pathSegments[1] : undefined
  const actorId = isActorReportRoute ? pathSegments[3] ?? null : isActorRoute ? pathSegments[2] ?? null : null
  const actorName = actorNameSegment ? decodeURIComponent(actorNameSegment) : null
  const userIdSegment = isReportRoute ? pathSegments[1] : isUserRoute ? pathSegments[1] : pathSegments[0]
  const userId = isActorRoute
    ? null
    : userIdSegment ? decodeURIComponent(userIdSegment) : null
  const sourceId = actorId && actorName ? `actor:${actorId}:${actorName}` : userId
  const subjectLabel = actorName ?? userId ?? sourceId

  const state = useScheduleStore()
  const visibleEvents = selectVisibleEvents(state)
  const nextEvent = selectNextEvent(state)
  const selectedEvent = selectSelectedEvent(state)
  const copy = getUiCopy(state.locale)
  const hasCachedDataForCurrentUser =
    sourceId !== null
    && state.cachedUserId === sourceId
    && (state.events.length > 0 || (state.participationCalendar?.length ?? 0) > 0)
  const shouldShowLoadingState = state.loading
    ? !hasCachedDataForCurrentUser
    : sourceId !== null && state.cachedUserId !== sourceId
  const shouldShowErrorState = Boolean(state.error) && !hasCachedDataForCurrentUser

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document.documentElement.style.colorScheme = state.theme
  }, [state.theme])

  useEffect(() => {
    if (!sourceId) return
    // Skip auto-fetch only when cache is fresh AND belongs to the current user
    if (
      state.cachedAt &&
      state.cachedUserId === sourceId &&
      (state.events.length > 0 || (state.participationCalendar?.length ?? 0) > 0)
    ) {
      const age = Date.now() - new Date(state.cachedAt).getTime()
      if (age < CACHE_TTL_MS) return
    }
    state.loadFromEventernote(sourceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId])

  if (!sourceId) {
    return (
      <LandingPage
        theme={state.theme}
        locale={state.locale}
        initialMode={isActorRoute ? 'actors' : 'users'}
        onThemeToggle={state.toggleTheme}
        onLocaleChange={state.setLocale}
      />
    )
  }

  if (isReportRoute) {
    return (
      <ReportPage
        userId={subjectLabel ?? sourceId}
        actorName={actorName ?? undefined}
        events={hasCachedDataForCurrentUser ? state.events : []}
        places={hasCachedDataForCurrentUser ? state.places : {}}
        participationCalendar={hasCachedDataForCurrentUser ? state.participationCalendar ?? [] : []}
        locale={state.locale}
        theme={state.theme}
        loading={shouldShowLoadingState || state.loading}
        indexProgress={state.indexProgress}
        error={state.error}
        onThemeToggle={state.toggleTheme}
        onRefresh={() => state.loadFromEventernote(sourceId, true)}
        onRefreshEvent={(eventId) => state.refreshEvent(sourceId, eventId)}
        onRefreshUnmappedPlaces={(placeIds) => state.refreshUnmappedPlaces(sourceId, placeIds)}
      />
    )
  }

  return (
    <div className="app-shell-root">
      <div className="app-shell app-shell--viewer">
        <Header
          locale={state.locale}
          theme={state.theme}
          daysToShow={state.daysToShow}
          cachedAt={state.cachedAt}
          loading={state.loading}
          onThemeToggle={state.toggleTheme}
          onDaysToShowChange={state.setDaysToShow}
          onRefresh={() => state.loadFromEventernote(sourceId, true)}
        />

        <main className="viewer-layout">
          {/**
           * Show spinner when:
           * - loading AND no correct-user data yet (first load or user switch)
           * - OR we have data but it belongs to a different user (pre-fetch 1-frame flash)
           * Same-user TTL refresh: loading=true but hasCachedDataForCurrentUser=true → show stale data + progress bar
           */}
          {shouldShowLoadingState ? (
            <div className="loading-state" aria-live="polite">
              <span className="loading-spinner" aria-hidden="true" />
              <p>{copy.loadingText}</p>
            </div>
          ) : shouldShowErrorState ? (
            <div className="error-state" role="alert">
              <p className="error-state__title">{copy.loadErrorTitle}</p>
              <p className="error-state__body">{state.error}</p>
              <button
                type="button"
                className="error-state__retry"
                onClick={() => state.loadFromEventernote(sourceId)}
              >
                {copy.loadRetry}
              </button>
            </div>
          ) : (
            <>
              {state.loading && (
                <div className="refresh-progress" role="progressbar" aria-label={copy.refreshing} />
              )}
              <Countdown locale={state.locale} nextEvent={nextEvent} />

              <div className="schedule-canvas">
                {visibleEvents.length === 0 ? (
                  <section className="empty-state" aria-live="polite">
                    <h2>{copy.noEventsTitle}</h2>
                    <p>{copy.emptyTitle}</p>
                  </section>
                ) : (
                  <TimelineView
                    events={visibleEvents}
                    locale={state.locale}
                    onOpenEvent={(eventId) => {
                      state.selectEvent(eventId)
                      void state.refreshEvent(sourceId, eventId)
                    }}
                    onRefreshEvent={(eventId) => state.refreshEvent(sourceId, eventId)}
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
          onRefreshEvent={(eventId) => state.refreshEvent(sourceId, eventId)}
        />
      </div>
    </div>
  )
}

export default App

