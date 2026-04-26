import { describe, expect, it } from 'vitest'

import { parseBookingPayload, parseEventTypePayload } from './validation'

describe('parseBookingPayload', () => {
  it('валидирует обязательные поля для бронирования', () => {
    const payload = parseBookingPayload({
      eventTypeId: 'intro-call',
      slotStartAt: '2026-05-01T09:00:00.000Z',
      guestName: 'Иван Петров',
      guestEmail: 'ivan@example.com'
    })

    expect(payload.eventTypeId).toBe('intro-call')
    expect(payload.guestEmail).toBe('ivan@example.com')
  })

  it('бросает ошибку на невалидном email', () => {
    expect(() =>
      parseBookingPayload({
        eventTypeId: 'intro-call',
        slotStartAt: '2026-05-01T09:00:00.000Z',
        guestName: 'Иван Петров',
        guestEmail: 'invalid-email'
      })
    ).toThrow()
  })
})

describe('parseEventTypePayload', () => {
  it('валидирует payload создания типа события', () => {
    const payload = parseEventTypePayload({
      id: 'sync-45',
      name: 'Синк',
      description: 'Короткая синхронизация',
      durationMinutes: '45'
    })

    expect(payload.durationMinutes).toBe(45)
  })
})
