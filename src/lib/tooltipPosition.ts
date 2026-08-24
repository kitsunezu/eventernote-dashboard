export function calculateTooltipPosition(viewportWidth: number, containingBlockLeft: number) {
  const viewportMargin = 16
  const width = Math.max(0, Math.min(320, viewportWidth - viewportMargin * 2))
  const minLeft = viewportMargin - containingBlockLeft
  const maxLeft = viewportWidth - containingBlockLeft - width - viewportMargin

  return {
    left: Math.max(minLeft, Math.min(8, maxLeft)),
    width,
  }
}

export function shouldPlaceTooltipBelow(
  viewportHeight: number,
  containingBlockTop: number,
  containingBlockBottom: number,
  tooltipHeight: number,
) {
  const viewportMargin = 16
  const tooltipGap = 10
  const spaceAbove = containingBlockTop - viewportMargin - tooltipGap
  const spaceBelow = viewportHeight - containingBlockBottom - viewportMargin - tooltipGap

  return tooltipHeight > spaceAbove && spaceBelow > spaceAbove
}
