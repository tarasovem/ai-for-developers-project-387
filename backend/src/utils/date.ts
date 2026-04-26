const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS)
}

export function toIso(value: Date): string {
  return value.toISOString()
}

export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0)
  )
}
