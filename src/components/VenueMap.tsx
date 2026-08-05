import { useEffect } from 'react'
import { latLngBounds } from 'leaflet'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScheduleEvent, SupportedLocale } from '../types/events'

export interface VenueMapPoint {
  name: string
  address: string
  latitude: number
  longitude: number
  approximate: boolean
  count: number
  events: ScheduleEvent[]
}

interface VenueMapProps {
  points: VenueMapPoint[]
  selectedVenue: string
  locale: SupportedLocale
  eventCountLabel: (count: number) => string
  approximateLocationLabel: string
  onSelectVenue: (venue: string) => void
  onRefreshEvent: (eventId: string) => void
}

function FitVenueBounds({ points }: { points: VenueMapPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    const bounds = latLngBounds(points.map((point) => [point.latitude, point.longitude]))
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 })
  }, [map, points])

  return null
}

function FocusVenue({ point }: { point?: VenueMapPoint }) {
  const map = useMap()

  useEffect(() => {
    if (point) map.flyTo([point.latitude, point.longitude], Math.max(map.getZoom(), 11))
  }, [map, point])

  return null
}

export function VenueMap({ points, selectedVenue, locale, eventCountLabel, approximateLocationLabel, onSelectVenue, onRefreshEvent }: VenueMapProps) {
  const selectedPoint = points.find((point) => point.name === selectedVenue)
  const initialCenter: [number, number] = points[0]
    ? [points[0].latitude, points[0].longitude]
    : [35.6812, 139.7671]

  return (
    <MapContainer center={initialCenter} zoom={5} scrollWheelZoom className="report-leaflet-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Address coordinates: <a href="https://www.gsi.go.jp/">GSI Japan</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitVenueBounds points={points} />
      <FocusVenue point={selectedPoint} />
      {points.map((point) => {
        const isSelected = point.name === selectedVenue
        const mapUrl = point.approximate && point.address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.address)}`
          : `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=16/${point.latitude}/${point.longitude}`
        return (
          <CircleMarker
            key={point.name}
            center={[point.latitude, point.longitude]}
            radius={isSelected ? 10 : Math.min(9, 5 + point.count)}
            pathOptions={{
              color: isSelected || point.approximate ? '#e8805b' : '#256d58',
              fillColor: isSelected || point.approximate ? '#e8a35b' : '#4fa184',
              fillOpacity: 0.82,
              weight: isSelected ? 3 : 2,
              dashArray: point.approximate ? '4 3' : undefined,
            }}
            eventHandlers={{ click: () => onSelectVenue(point.name) }}
          >
            <Popup minWidth={240}>
              <div className="report-map-popup">
                <strong>{point.name}</strong>
                {point.address && <span>{point.address}</span>}
                {point.approximate && <small>{approximateLocationLabel}</small>}
                <small>{eventCountLabel(point.count)}</small>
                <ul>
                  {point.events.slice(0, 5).map((event) => (
                    <li key={event.id}>
                      <time>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(event.startAt))}</time>
                      <span>{event.title}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    const eventId = point.events[0]?.id
                    if (eventId) onRefreshEvent(eventId)
                  }}
                >
                  {point.approximate && point.address ? 'Google Maps' : 'OpenStreetMap'}
                </a>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
