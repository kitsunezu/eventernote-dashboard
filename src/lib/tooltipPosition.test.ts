import { describe, expect, it } from 'vitest'
import { calculateTooltipPosition, shouldPlaceTooltipBelow } from './tooltipPosition'

describe('calculateTooltipPosition', () => {
  it('keeps the tooltip inside a narrow iframe viewport', () => {
    const viewportWidth = 395
    const containingBlockLeft = 137
    const position = calculateTooltipPosition(viewportWidth, containingBlockLeft)

    expect(position).toEqual({ left: -78, width: 320 })
    expect(containingBlockLeft + position.left).toBe(59)
    expect(containingBlockLeft + position.left + position.width).toBe(379)
  })

  it('uses the preferred inset when there is enough room', () => {
    expect(calculateTooltipPosition(1280, 200)).toEqual({ left: 8, width: 320 })
  })

  it('places a tall tooltip below a card near the top edge', () => {
    expect(shouldPlaceTooltipBelow(1089, 224, 344, 562)).toBe(true)
  })

  it('keeps a tooltip above a card when there is enough room', () => {
    expect(shouldPlaceTooltipBelow(1089, 700, 820, 320)).toBe(false)
  })
})
