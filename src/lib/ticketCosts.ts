export const REPORT_CURRENCIES = ['JPY', 'HKD', 'TWD', 'USD'] as const
export type ReportCurrency = (typeof REPORT_CURRENCIES)[number]

interface TicketCostData {
  currency: ReportCurrency
  amounts: Record<string, number>
}

const STORAGE_PREFIX = 'eventernote:report-costs:v1:'

export function readTicketCosts(userId: string): TicketCostData {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!raw) return { currency: 'JPY', amounts: {} }
    const parsed = JSON.parse(raw) as Partial<TicketCostData>
    const currency = REPORT_CURRENCIES.includes(parsed.currency as ReportCurrency)
      ? (parsed.currency as ReportCurrency)
      : 'JPY'
    const amounts = Object.fromEntries(
      Object.entries(parsed.amounts ?? {}).filter(([, amount]) => Number.isFinite(amount) && amount >= 0),
    ) as Record<string, number>
    return { currency, amounts }
  } catch {
    return { currency: 'JPY', amounts: {} }
  }
}

export function writeTicketCosts(userId: string, data: TicketCostData): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(data))
  } catch {
    // Ticket prices are optional local enhancements; keep the report usable if storage is unavailable.
  }
}
