const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export class EventernoteClient {
  private readonly origin: URL
  private readonly timeoutMs: number
  private readonly minIntervalMs: number
  private startGate: Promise<void> = Promise.resolve()
  private nextStartAt = 0

  constructor(origin: string, timeoutMs: number, minIntervalMs: number) {
    this.origin = new URL(origin)
    this.timeoutMs = timeoutMs
    this.minIntervalMs = minIntervalMs
  }

  async fetchHtml(path: string): Promise<string> {
    if (!path.startsWith('/')) throw new Error(`Upstream path must start with /: ${path}`)
    const url = new URL(path, this.origin)
    if (url.origin !== this.origin.origin) throw new Error(`Refusing cross-origin upstream URL: ${url}`)

    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.waitForRequestSlot()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': `${this.origin.origin}/`,
          },
          redirect: 'follow',
          signal: controller.signal,
        })
        if (response.ok) return response.text()
        const retryable = response.status === 429 || response.status >= 500
        const error = new Error(`Eventernote returned HTTP ${response.status} for ${path}`)
        if (!retryable) throw error
        lastError = error
        const retryAfterSeconds = Number(response.headers.get('retry-after'))
        const backoffMs = Number.isFinite(retryAfterSeconds)
          ? Math.min(retryAfterSeconds * 1000, 30_000)
          : 750 * 2 ** attempt
        await delay(backoffMs)
      } catch (error) {
        lastError = error
        if (error instanceof Error && error.message.startsWith('Eventernote returned HTTP 4')) {
          throw error
        }
        if (attempt < 2) await delay(750 * 2 ** attempt)
      } finally {
        clearTimeout(timeout)
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${path}`)
  }

  private waitForRequestSlot(): Promise<void> {
    const wait = this.startGate.then(async () => {
      const waitMs = Math.max(0, this.nextStartAt - Date.now())
      if (waitMs > 0) await delay(waitMs)
      this.nextStartAt = Date.now() + this.minIntervalMs
    })
    this.startGate = wait.catch(() => undefined)
    return wait
  }
}
