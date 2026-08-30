import { Dithering } from '@paper-design/shaders-react'
import { useEffect, useRef, useState } from 'react'

const REFERENCE_WIDTH = 741
const REFERENCE_HEIGHT = 290
const VERTICAL_SCALE = REFERENCE_HEIGHT / 425
const ASPECT_RATIO = REFERENCE_WIDTH / REFERENCE_HEIGHT
const PERFORATION = 562 / REFERENCE_WIDTH
const CORNER_RADIUS = 25 / REFERENCE_WIDTH
const NOTCH_RADIUS = 21 / REFERENCE_WIDTH

interface AdmitOneTicketProps {
  name: string
  presenter: string
  venue: string
  dates: string
  stubText: string
  watermark: string
}

function ticketClipPath(width: number, height: number): string {
  const corner = CORNER_RADIUS * width
  const notch = NOTCH_RADIUS * width
  const perforation = PERFORATION * width

  return [
    `M ${corner} 0`,
    `L ${perforation - notch} 0`,
    `A ${notch} ${notch} 0 0 0 ${perforation + notch} 0`,
    `L ${width - corner} 0`,
    `A ${corner} ${corner} 0 0 0 ${width} ${corner}`,
    `L ${width} ${height - corner}`,
    `A ${corner} ${corner} 0 0 0 ${width - corner} ${height}`,
    `L ${perforation + notch} ${height}`,
    `A ${notch} ${notch} 0 0 0 ${perforation - notch} ${height}`,
    `L ${corner} ${height}`,
    `A ${corner} ${corner} 0 0 0 0 ${height - corner}`,
    `L 0 ${corner}`,
    `A ${corner} ${corner} 0 0 0 ${corner} 0`,
    'Z',
  ].join(' ')
}

function splitName(name: string, maxLines = 3): string[] {
  const clean = name.trim().replace(/\s+/g, ' ').toUpperCase()
  if (!clean) return []

  const words = clean.split(' ')
  if (words.length === 1) {
    const chunkSize = Math.ceil(clean.length / maxLines)
    return clean.length > 18
      ? Array.from({ length: maxLines }, (_, index) => clean.slice(index * chunkSize, (index + 1) * chunkSize))
        .filter(Boolean)
      : [clean]
  }

  const lines: string[] = []
  const targetLength = Math.ceil(clean.length / maxLines)
  let currentLine = ''
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (currentLine && candidate.length > targetLength && lines.length < maxLines - 1) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = candidate
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function fitNameScale(lines: string[], width: number): number {
  if (lines.length === 0) return 1
  const availableWidth = PERFORATION * width - 0.077 * width - 0.03 * width
  const availableHeight = ((348 - 185) * VERTICAL_SCALE / REFERENCE_WIDTH - 0.02) * width
  const fontSize = 64.79 * VERTICAL_SCALE / REFERENCE_WIDTH * width
  const lineHeight = 65 * VERTICAL_SCALE / REFERENCE_WIDTH * width
  const longestLine = Math.max(...lines.map((line) => line.length))
  const characterWidth = 0.59 * fontSize

  return Math.max(
    0.2,
    Math.min(
      1,
      availableWidth / Math.max(1, longestLine * characterWidth),
      availableHeight / Math.max(1, lines.length * lineHeight),
    ),
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

export function AdmitOneTicket({
  name,
  presenter,
  venue,
  dates,
  stubText,
  watermark,
}: AdmitOneTicketProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(REFERENCE_WIDTH)
  const [hovering, setHovering] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const height = width / ASPECT_RATIO
  const perforation = PERFORATION * width
  const lines = splitName(name)
  const nameScale = fitNameScale(lines, width)
  const clipPath = `path('${ticketClipPath(width, height)}')`

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const updateWidth = () => {
      const style = getComputedStyle(frame)
      const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
      setWidth(Math.min(REFERENCE_WIDTH, Math.max(0, frame.clientWidth - horizontalPadding)))
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const resetTilt = () => {
    setHovering(false)
    if (cardRef.current) cardRef.current.style.transform = ''
    if (glareRef.current) glareRef.current.style.background = 'transparent'
  }

  return (
    <div ref={frameRef} className="admit-ticket-frame">
      <div
        ref={cardRef}
        className={`admit-ticket${hovering ? ' is-hovering' : ''}`}
        style={{ width, height, clipPath }}
        onPointerEnter={() => setHovering(true)}
        onPointerMove={(pointerEvent) => {
          if (reducedMotion || !cardRef.current) return
          const bounds = cardRef.current.getBoundingClientRect()
          const x = (pointerEvent.clientX - bounds.left) / bounds.width - 0.5
          const y = (pointerEvent.clientY - bounds.top) / bounds.height - 0.5
          cardRef.current.style.transform = `perspective(1200px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) scale(1.012)`
          if (glareRef.current) {
            glareRef.current.style.background = `radial-gradient(38% 55% at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(255,255,255,0.14), transparent 70%)`
          }
        }}
        onPointerLeave={resetTilt}
      >
        <div className="admit-ticket__fallback" />
        <Dithering
          aria-hidden="true"
          className="admit-ticket__shader"
          colorBack="#b84b0d"
          colorFront="#e88538"
          shape="warp"
          type="random"
          size={0.5}
          scale={1}
          speed={reducedMotion ? 0 : 0.4}
          width={width}
          height={height}
          minPixelRatio={1}
          maxPixelCount={1920 * 1080}
        />

        <div
          className="admit-ticket__perforation"
          style={{ left: perforation, width: Math.max(1, 0.0022 * width) }}
        />
        <div
          className="admit-ticket__watermark"
          style={{
            left: perforation,
            width: width - perforation,
            fontSize: 144 * VERTICAL_SCALE / REFERENCE_WIDTH * width,
          }}
          aria-hidden="true"
        >
          <span>{watermark}</span>
        </div>

        <div
          className="admit-ticket__label"
          style={{
            left: 57 / REFERENCE_WIDTH * width,
            top: 58 * VERTICAL_SCALE / REFERENCE_WIDTH * width,
            fontSize: Math.max(10, 19.72 * VERTICAL_SCALE / REFERENCE_WIDTH * width),
            lineHeight: `${Math.max(12, 28 * VERTICAL_SCALE / REFERENCE_WIDTH * width)}px`,
          }}
        >
          {presenter}
        </div>

        <div
          className="admit-ticket__name"
          style={{
            left: 57 / REFERENCE_WIDTH * width,
            top: 185 * VERTICAL_SCALE / REFERENCE_WIDTH * width,
            fontSize: Math.max(12, 64.79 * VERTICAL_SCALE / REFERENCE_WIDTH * width * nameScale),
            lineHeight: `${Math.max(13, 65 * VERTICAL_SCALE / REFERENCE_WIDTH * width * nameScale)}px`,
          }}
        >
          {lines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
        </div>

        <div
          className="admit-ticket__footer"
          style={{
            left: 57 / REFERENCE_WIDTH * width,
            top: 348 * VERTICAL_SCALE / REFERENCE_WIDTH * width,
            maxWidth: perforation - 82 / REFERENCE_WIDTH * width,
            fontSize: Math.max(9, 19.72 * VERTICAL_SCALE / REFERENCE_WIDTH * width),
          }}
        >
          {venue}{venue && dates ? ' · ' : ''}{dates}
        </div>

        <div
          className="admit-ticket__stub"
          style={{
            left: perforation,
            width: width - perforation,
            fontSize: Math.max(17, 52 * VERTICAL_SCALE / REFERENCE_WIDTH * width),
          }}
        >
          <span>{stubText}</span>
        </div>

        <div ref={glareRef} className="admit-ticket__glare" aria-hidden="true" />
      </div>
    </div>
  )
}
