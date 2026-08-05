import { describe, expect, it } from 'vitest'
import { resolveVenueCoordinates } from './venueCoordinates'

describe('resolveVenueCoordinates', () => {
  it('keeps valid Eventernote coordinates', () => {
    expect(resolveVenueCoordinates({
      name: 'Venue A',
      address: 'Tokyo',
      region: '東京',
      latitude: 35.7,
      longitude: 139.7,
    })).toEqual({ latitude: 35.7, longitude: 139.7, approximate: false })
  })

  it('does not invent a city-level coordinate for physical venues', () => {
    expect(resolveVenueCoordinates({
      name: 'Venue B',
      address: '東京都新宿区',
      region: '東京',
      latitude: 0,
      longitude: 0,
    })).toBeUndefined()
  })

  it('does not invent a location for virtual venues', () => {
    expect(resolveVenueCoordinates({
      name: 'Live viewing',
      address: '',
      region: 'Other',
    })).toBeUndefined()
  })
})
