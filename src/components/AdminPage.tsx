import dayjs from 'dayjs'
import { useEffect, useState, type FormEvent } from 'react'
import { colorForCategory, formatEventDate, formatEventTime } from '../lib/date'
import { LOCALE_LABELS, SUPPORTED_LOCALES, getUiCopy, resolveCategoryLabel, resolveEventCopy, resolveLinkLabel } from '../lib/localize'
import type { EventCategory, EventLink, EventSourceKind, ScheduleEvent, SupportedLocale } from '../types/events'

interface AdminPageProps {
  locale: SupportedLocale
  events: ScheduleEvent[]
  categories: EventCategory[]
  selectedCategoryIds: string[]
  activeSource: EventSourceKind
  totalCount: number
  visibleCount: number
  statusMessage: string
  onLocaleChange: (locale: SupportedLocale) => void
  onToggleCategory: (categoryId: string) => void
  onShowAll: () => void
  onImportJson: () => void
  onImportIcs: () => void
  onUpsertEvent: (event: ScheduleEvent) => void
  onDeleteEvent: (eventId: string) => void
}

type EditorMode = 'create' | 'edit'

interface AdminLinkDraft {
  key: string
  label: string
  url: string
}

interface AdminEventDraft {
  title: string
  description: string
  notes: string
  location: string
  categoryId: string
  categoryLabel: string
  categoryColor: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  allDay: boolean
  previewImageUrl: string
  previewImageAlt: string
  links: AdminLinkDraft[]
}

const SOURCE_LABELS: Record<EventSourceKind, string> = {
  sample: 'Sample',
  json: 'JSON',
  ics: 'ICS',
  backend: 'Manual',
  google: 'Google',
  outlook: 'Outlook',
}

function createDraftKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createEmptyDraft(categories: EventCategory[]): AdminEventDraft {
  const fallbackCategory = categories[0] ?? {
    id: 'general',
    label: 'General',
    color: colorForCategory('general'),
  }
  const start = dayjs().add(1, 'day').hour(9).minute(0).second(0).millisecond(0)
  const end = start.add(1, 'hour')

  return {
    title: '',
    description: '',
    notes: '',
    location: '',
    categoryId: fallbackCategory.id,
    categoryLabel: fallbackCategory.label,
    categoryColor: fallbackCategory.color,
    startDate: start.format('YYYY-MM-DD'),
    startTime: start.format('HH:mm'),
    endDate: end.format('YYYY-MM-DD'),
    endTime: end.format('HH:mm'),
    allDay: false,
    previewImageUrl: '',
    previewImageAlt: '',
    links: [],
  }
}

function createDraftFromEvent(event: ScheduleEvent, locale: SupportedLocale): AdminEventDraft {
  const copy = resolveEventCopy(event, locale)

  return {
    title: copy.title,
    description: copy.description ?? '',
    notes: copy.notes ?? '',
    location: copy.location ?? '',
    categoryId: event.category.id,
    categoryLabel: resolveCategoryLabel(event.category, locale),
    categoryColor: event.category.color,
    startDate: dayjs(event.startAt).format('YYYY-MM-DD'),
    startTime: dayjs(event.startAt).format('HH:mm'),
    endDate: dayjs(event.endAt).format('YYYY-MM-DD'),
    endTime: dayjs(event.endAt).format('HH:mm'),
    allDay: event.allDay,
    previewImageUrl: event.previewImageUrl ?? '',
    previewImageAlt: event.previewImageAlt ?? '',
    links: event.links.map((link, index) => ({
      key: `${event.id}-${index}`,
      label: resolveLinkLabel(link, locale),
      url: link.url,
    })),
  }
}

function buildEventFromDraft(draft: AdminEventDraft, existingEvent: ScheduleEvent | null, locale: SupportedLocale): ScheduleEvent {
  const title = draft.title.trim()
  const description = draft.description.trim()
  const notes = draft.notes.trim()
  const location = draft.location.trim()
  const categoryId = slugify(draft.categoryId) || slugify(draft.categoryLabel) || 'general'
  const categoryLabel = draft.categoryLabel.trim() || categoryId
  const currentLocalized = existingEvent?.localized?.[locale]
  const shouldSyncBackendBase = existingEvent?.sourceType === 'backend'
  const shouldSyncBaseTitle =
    !existingEvent ||
    locale === 'en' ||
    shouldSyncBackendBase ||
    !existingEvent.title ||
    existingEvent.title === (currentLocalized?.title ?? existingEvent.title)
  const shouldSyncBaseDescription =
    !existingEvent ||
    locale === 'en' ||
    shouldSyncBackendBase ||
    !existingEvent.description ||
    existingEvent.description === (currentLocalized?.description ?? existingEvent.description)
  const shouldSyncBaseNotes =
    !existingEvent ||
    locale === 'en' ||
    shouldSyncBackendBase ||
    !existingEvent.notes ||
    existingEvent.notes === (currentLocalized?.notes ?? existingEvent.notes)
  const shouldSyncBaseLocation =
    !existingEvent ||
    locale === 'en' ||
    shouldSyncBackendBase ||
    !existingEvent.location ||
    existingEvent.location === (currentLocalized?.location ?? existingEvent.location)
  const shouldSyncBaseCategoryLabel =
    !existingEvent ||
    locale === 'en' ||
    shouldSyncBackendBase ||
    !existingEvent.category.label ||
    existingEvent.category.label === (existingEvent.category.labels?.[locale] ?? existingEvent.category.label)
  const startAt = draft.allDay
    ? dayjs(`${draft.startDate}T00:00`).toISOString()
    : dayjs(`${draft.startDate}T${draft.startTime || '00:00'}`).toISOString()
  const endAt = draft.allDay
    ? dayjs(`${draft.endDate}T23:59`).toISOString()
    : dayjs(`${draft.endDate}T${draft.endTime || '00:00'}`).toISOString()
  const categoryLabels = {
    ...(existingEvent?.category.labels ?? {}),
    [locale]: categoryLabel,
  }
  const localized = {
    ...(existingEvent?.localized ?? {}),
    [locale]: {
      title,
      description: description || undefined,
      notes: notes || undefined,
      location: location || undefined,
    },
  }
  const links = draft.links.reduce<EventLink[]>((items, linkDraft, index) => {
      const url = linkDraft.url.trim()
      if (!url) {
        return items
      }

      const existingLink = existingEvent?.links[index]
      const label = linkDraft.label.trim() || url
      const localizedLabel = {
        ...(existingLink?.localizedLabel ?? {}),
        [locale]: label,
      }
      const shouldSyncBaseLink =
        !existingLink ||
        locale === 'en' ||
        shouldSyncBackendBase ||
        !existingLink.label ||
        existingLink.label === (existingLink.localizedLabel?.[locale] ?? existingLink.label)

      items.push({
        label: shouldSyncBaseLink ? label : existingLink.label,
        url,
        localizedLabel: Object.keys(localizedLabel).length > 0 ? localizedLabel : undefined,
      })

      return items
    }, [])

  return {
    id: existingEvent?.id ?? createEventId(),
    title: shouldSyncBaseTitle ? title : existingEvent.title,
    startAt,
    endAt,
    allDay: draft.allDay,
    category: {
      id: categoryId,
      label: shouldSyncBaseCategoryLabel ? categoryLabel : existingEvent.category.label,
      color: draft.categoryColor.trim() || colorForCategory(categoryId),
      labels: categoryLabels,
    },
    description: shouldSyncBaseDescription ? description || undefined : existingEvent.description,
    notes: shouldSyncBaseNotes ? notes || undefined : existingEvent.notes,
    location: shouldSyncBaseLocation ? location || undefined : existingEvent.location,
    links,
    sourceType: 'backend',
    sourceMeta: existingEvent?.sourceMeta,
    localized,
    previewImageUrl: draft.previewImageUrl.trim() || undefined,
    previewImageAlt: draft.previewImageAlt.trim() || title,
  }
}

export function AdminPage({
  locale,
  events,
  categories,
  selectedCategoryIds,
  activeSource,
  totalCount,
  visibleCount,
  statusMessage,
  onLocaleChange,
  onToggleCategory,
  onShowAll,
  onImportJson,
  onImportIcs,
  onUpsertEvent,
  onDeleteEvent,
}: AdminPageProps) {
  const copy = getUiCopy(locale)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null)
  const [mode, setMode] = useState<EditorMode>(events.length > 0 ? 'edit' : 'create')
  const [draft, setDraft] = useState<AdminEventDraft>(() => createEmptyDraft(categories))
  const [formError, setFormError] = useState('')
  const editingEvent = mode === 'edit' ? events.find((event) => event.id === selectedEventId) ?? null : null

  useEffect(() => {
    if (mode === 'edit' && editingEvent) {
      setDraft(createDraftFromEvent(editingEvent, locale))
      setFormError('')
    }
  }, [editingEvent, locale, mode])

  useEffect(() => {
    if (mode !== 'edit' || editingEvent) {
      return
    }

    if (events[0]) {
      setSelectedEventId(events[0].id)
      return
    }

    setMode('create')
    setDraft(createEmptyDraft(categories))
    setFormError('')
  }, [categories, editingEvent, events, mode])

  function updateDraft<Field extends keyof AdminEventDraft>(field: Field, value: AdminEventDraft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function updateLink(linkKey: string, field: 'label' | 'url', value: string) {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link) => (link.key === linkKey ? { ...link, [field]: value } : link)),
    }))
  }

  function addLink() {
    setDraft((current) => ({
      ...current,
      links: [...current.links, { key: createDraftKey(), label: '', url: '' }],
    }))
  }

  function removeLink(linkKey: string) {
    setDraft((current) => ({
      ...current,
      links: current.links.filter((link) => link.key !== linkKey),
    }))
  }

  function startCreateEvent() {
    setMode('create')
    setSelectedEventId(null)
    setDraft(createEmptyDraft(categories))
    setFormError('')
  }

  function selectEvent(eventId: string) {
    setMode('edit')
    setSelectedEventId(eventId)
    setFormError('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.title.trim()) {
      setFormError(copy.saveErrorTitle)
      return
    }

    const start = draft.allDay ? dayjs(`${draft.startDate}T00:00`) : dayjs(`${draft.startDate}T${draft.startTime || '00:00'}`)
    const end = draft.allDay ? dayjs(`${draft.endDate}T23:59`) : dayjs(`${draft.endDate}T${draft.endTime || '00:00'}`)

    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      setFormError(copy.saveErrorRange)
      return
    }

    const nextEvent = buildEventFromDraft(draft, editingEvent, locale)
    onUpsertEvent(nextEvent)
    setMode('edit')
    setSelectedEventId(nextEvent.id)
    setFormError('')
  }

  function handleDelete() {
    if (!editingEvent || !window.confirm(copy.deleteConfirm)) {
      return
    }

    const remainingEvents = events.filter((event) => event.id !== editingEvent.id)
    onDeleteEvent(editingEvent.id)

    if (remainingEvents[0]) {
      setMode('edit')
      setSelectedEventId(remainingEvents[0].id)
      return
    }

    startCreateEvent()
  }

  return (
    <div className="app-shell app-shell--admin">
      <section className="admin-panel">
        <div className="admin-panel__hero">
          <div>
            <p className="eyebrow">{copy.adminEyebrow}</p>
            <h1>{copy.adminTitle}</h1>
            <p>{copy.adminDescription}</p>
          </div>

          <div className="admin-panel__status">
            <div className="status-badge">{copy.visibleSummary(visibleCount, totalCount)}</div>
            <div className="source-badge">{SOURCE_LABELS[activeSource]}</div>
            <p className="status-note">{statusMessage}</p>
          </div>
        </div>

        <div className="admin-workbench">
          <aside className="admin-sidebar">
            <section className="admin-card">
              <p className="eyebrow">{copy.localeLabel}</p>
              <div className="segmented" role="tablist" aria-label={copy.localeLabel}>
                {SUPPORTED_LOCALES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`segmented__button ${locale === option ? 'is-active' : ''}`}
                    onClick={() => onLocaleChange(option)}
                  >
                    {LOCALE_LABELS[option]}
                  </button>
                ))}
              </div>
            </section>

            <section className="admin-card">
              <div className="admin-card__head">
                <p className="eyebrow">{copy.categoryLabel}</p>
                <button className="button button--ghost" type="button" onClick={onShowAll}>
                  {copy.showAll}
                </button>
              </div>

              <div className="admin-chip-grid">
                {categories.map((category) => {
                  const isActive = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(category.id)
                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`chip ${isActive ? 'is-active' : ''}`}
                      onClick={() => onToggleCategory(category.id)}
                    >
                      <span
                        aria-hidden="true"
                        style={{ width: 10, height: 10, borderRadius: '999px', background: category.color }}
                      />
                      {resolveCategoryLabel(category, locale)}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="admin-card">
              <p className="eyebrow">{copy.dataLabel}</p>
              <div className="toolbar__group">
                <button className="button button--ghost" type="button" onClick={onImportJson}>
                  {copy.importJson}
                </button>
                <button className="button button--ghost" type="button" onClick={onImportIcs}>
                  {copy.importIcs}
                </button>
                <a className="button button--solid button--link" href="/">
                  {copy.viewerLink}
                </a>
              </div>
            </section>
          </aside>

          <div className="admin-stage">
            <section className="admin-card admin-card--events">
              <div className="admin-card__head">
                <div>
                  <p className="eyebrow">{copy.eventLibrary}</p>
                  <strong>{events.length}</strong>
                </div>
                <button className="button button--solid" type="button" onClick={startCreateEvent}>
                  {copy.createNewEvent}
                </button>
              </div>

              <div className="admin-event-list">
                {events.length === 0 ? (
                  <p className="status-note">{copy.noEventsYet}</p>
                ) : (
                  events.map((event) => {
                    const eventCopy = resolveEventCopy(event, locale)

                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={`admin-eventRow ${selectedEventId === event.id && mode === 'edit' ? 'is-active' : ''}`}
                        onClick={() => selectEvent(event.id)}
                      >
                        <span className="admin-eventRow__swatch" style={{ background: event.category.color }} aria-hidden="true" />
                        <span className="admin-eventRow__body">
                          <strong>{eventCopy.title}</strong>
                          <span className="admin-eventRow__meta">
                            <span>
                              {formatEventDate(event, locale)} · {formatEventTime(event, locale)}
                            </span>
                            {eventCopy.location ? <span>{eventCopy.location}</span> : null}
                          </span>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            <section className="admin-card admin-card--editor">
              <div className="admin-card__head">
                <div>
                  <p className="eyebrow">{copy.manageEvents}</p>
                  <strong>{mode === 'create' ? copy.createEvent : copy.editEvent}</strong>
                </div>
                {mode === 'edit' ? (
                  <button className="button button--ghost" type="button" onClick={startCreateEvent}>
                    {copy.createNewEvent}
                  </button>
                ) : null}
              </div>

              {formError ? (
                <p className="admin-form__error" role="alert">
                  {formError}
                </p>
              ) : null}

              <form className="admin-form" onSubmit={handleSubmit}>
                <div className="admin-form__grid">
                  <label className="field field--wide">
                    <span>{copy.titleLabel}</span>
                    <input
                      className="text-input"
                      type="text"
                      value={draft.title}
                      onChange={(event) => updateDraft('title', event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>{copy.startDateLabel}</span>
                    <input
                      className="text-input"
                      type="date"
                      value={draft.startDate}
                      onChange={(event) => updateDraft('startDate', event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>{copy.startTimeLabel}</span>
                    <input
                      className="text-input"
                      type="time"
                      value={draft.startTime}
                      disabled={draft.allDay}
                      onChange={(event) => updateDraft('startTime', event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>{copy.endDateLabel}</span>
                    <input
                      className="text-input"
                      type="date"
                      value={draft.endDate}
                      onChange={(event) => updateDraft('endDate', event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>{copy.endTimeLabel}</span>
                    <input
                      className="text-input"
                      type="time"
                      value={draft.endTime}
                      disabled={draft.allDay}
                      onChange={(event) => updateDraft('endTime', event.target.value)}
                    />
                  </label>

                  <label className="field field--wide">
                    <span>{copy.allDayLabel}</span>
                    <span className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={draft.allDay}
                        onChange={(event) => updateDraft('allDay', event.target.checked)}
                      />
                      <span>{copy.allDayLabel}</span>
                    </span>
                  </label>

                  <label className="field">
                    <span>{copy.categoryNameLabel}</span>
                    <input
                      className="text-input"
                      type="text"
                      value={draft.categoryLabel}
                      onChange={(event) => updateDraft('categoryLabel', event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>{copy.categoryIdLabel}</span>
                    <input
                      className="text-input"
                      type="text"
                      value={draft.categoryId}
                      onChange={(event) => updateDraft('categoryId', event.target.value)}
                    />
                  </label>

                  <label className="field field--wide">
                    <span>{copy.categoryColorLabel}</span>
                    <input
                      className="text-input"
                      type="text"
                      value={draft.categoryColor}
                      placeholder="#c77939"
                      onChange={(event) => updateDraft('categoryColor', event.target.value)}
                    />
                  </label>

                  <label className="field field--wide">
                    <span>{copy.locationLabel}</span>
                    <input
                      className="text-input"
                      type="text"
                      value={draft.location}
                      onChange={(event) => updateDraft('location', event.target.value)}
                    />
                  </label>

                  <label className="field field--wide">
                    <span>{copy.descriptionLabel}</span>
                    <textarea
                      className="text-area"
                      rows={3}
                      value={draft.description}
                      onChange={(event) => updateDraft('description', event.target.value)}
                    />
                  </label>

                  <label className="field field--wide">
                    <span>{copy.notesLabel}</span>
                    <textarea
                      className="text-area"
                      rows={4}
                      value={draft.notes}
                      onChange={(event) => updateDraft('notes', event.target.value)}
                    />
                  </label>

                  <label className="field field--wide">
                    <span>{copy.previewImageLabel}</span>
                    <input
                      className="text-input"
                      type="url"
                      value={draft.previewImageUrl}
                      onChange={(event) => updateDraft('previewImageUrl', event.target.value)}
                    />
                  </label>

                  <label className="field field--wide">
                    <span>{copy.previewAltLabel}</span>
                    <input
                      className="text-input"
                      type="text"
                      value={draft.previewImageAlt}
                      onChange={(event) => updateDraft('previewImageAlt', event.target.value)}
                    />
                  </label>
                </div>

                <div className="admin-links">
                  <div className="admin-card__head">
                    <p className="eyebrow">{copy.linksLabel}</p>
                    <button className="button button--ghost" type="button" onClick={addLink}>
                      {copy.addLink}
                    </button>
                  </div>

                  {draft.links.map((link) => (
                    <div key={link.key} className="admin-links__row">
                      <label className="field">
                        <span>{copy.linkLabel}</span>
                        <input
                          className="text-input"
                          type="text"
                          value={link.label}
                          onChange={(event) => updateLink(link.key, 'label', event.target.value)}
                        />
                      </label>

                      <label className="field">
                        <span>{copy.linkUrl}</span>
                        <input
                          className="text-input"
                          type="url"
                          value={link.url}
                          onChange={(event) => updateLink(link.key, 'url', event.target.value)}
                        />
                      </label>

                      <button
                        className="button button--ghost icon-button"
                        type="button"
                        aria-label={copy.deleteEvent}
                        title={copy.deleteEvent}
                        onClick={() => removeLink(link.key)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="admin-form__actions">
                  <button className="button button--solid" type="submit">
                    {mode === 'create' ? copy.createEvent : copy.saveChanges}
                  </button>

                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={!editingEvent}
                    onClick={handleDelete}
                  >
                    {copy.deleteEvent}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}