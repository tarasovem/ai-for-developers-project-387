const DAY_MS = 24 * 60 * 60 * 1000

export function toIso(value: Date): string {
  return value.toISOString()
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS)
}

export function formatDateTime(value: string, locale = 'ru-RU'): string {
  return new Date(value).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function getDefaultWindow(): { from: string; to: string } {
  const now = new Date()
  return {
    from: toIso(now),
    to: toIso(addDays(now, 14))
  }
}

export function toUtcFromLocalInput(value: string): string {
  return new Date(value).toISOString()
}
