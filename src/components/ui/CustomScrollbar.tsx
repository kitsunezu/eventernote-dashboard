import { useEffect, useState } from 'react'

const TRACK_INSET = 8
const MIN_THUMB_SIZE = 28
const HIDE_DELAY = 700

interface ScrollbarMetrics {
  scrollable: boolean
  thumbOffset: number
  thumbSize: number
}

const INITIAL_METRICS: ScrollbarMetrics = {
  scrollable: false,
  thumbOffset: 0,
  thumbSize: 0,
}

export function CustomScrollbar() {
  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [scrolling, setScrolling] = useState(false)

  useEffect(() => {
    let animationFrame: number | null = null
    let hideTimer: number | undefined

    const updateMetrics = () => {
      if (animationFrame !== null) return

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null
        const scrollingElement = document.scrollingElement ?? document.documentElement
        const viewportHeight = scrollingElement.clientHeight
        const scrollHeight = scrollingElement.scrollHeight
        const scrollRange = Math.max(0, scrollHeight - viewportHeight)

        if (scrollRange === 0) {
          setMetrics(INITIAL_METRICS)
          return
        }

        const trackHeight = Math.max(1, viewportHeight - TRACK_INSET * 2)
        const thumbSize = Math.min(
          trackHeight,
          Math.max(MIN_THUMB_SIZE, trackHeight * viewportHeight / scrollHeight),
        )
        const scrollTop = Math.min(scrollRange, Math.max(0, scrollingElement.scrollTop))
        const thumbOffset = (trackHeight - thumbSize) * scrollTop / scrollRange

        setMetrics({ scrollable: true, thumbOffset, thumbSize })
      })
    }

    const handleScroll = () => {
      setScrolling(true)
      if (hideTimer !== undefined) window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => {
        hideTimer = undefined
        setScrolling(false)
      }, HIDE_DELAY)
      updateMetrics()
    }

    updateMetrics()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', updateMetrics)

    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(document.body)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateMetrics)
      resizeObserver.disconnect()
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      if (hideTimer !== undefined) window.clearTimeout(hideTimer)
    }
  }, [])

  if (!metrics.scrollable) return null

  return (
    <div
      className={`custom-scrollbar${scrolling ? ' is-visible' : ''}`}
      aria-hidden="true"
    >
      <div className="custom-scrollbar__track">
        <div
          className="custom-scrollbar__thumb"
          style={{
            height: `${metrics.thumbSize}px`,
            transform: `translateY(${metrics.thumbOffset}px)`,
          }}
        />
      </div>
    </div>
  )
}
