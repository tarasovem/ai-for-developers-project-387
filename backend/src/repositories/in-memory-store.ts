import { addDays } from '../utils/date.js'
import type { Booking, EventType, Owner } from '../types.js'

export interface InMemoryStore {
  owner: Owner
  eventTypes: EventType[]
  bookings: Booking[]
}

function buildSeedBookingStartAt(): Date {
  const now = new Date()
  const tomorrow = addDays(now, 1)
  return new Date(
    Date.UTC(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth(),
      tomorrow.getUTCDate(),
      9,
      0,
      0
    )
  )
}

export function createInMemoryStore(): InMemoryStore {
  const owner: Owner = {
    id: 'owner-default',
    displayName: 'Tota',
    timezone: 'Europe/Moscow',
    isDefaultProfile: true
  }

  const eventTypes: EventType[] = [
    {
      id: 'meeting-15',
      name: 'Встреча 15 минут',
      description: 'Короткий тип события для быстрого слота.',
      durationMinutes: 15
    },
    {
      id: 'meeting-30',
      name: 'Встреча 30 минут',
      description: 'Базовый тип события для бронирования.',
      durationMinutes: 30
    }
  ]

  const seedStartAt = buildSeedBookingStartAt()
  const seedEndAt = new Date(seedStartAt.getTime() + 15 * 60 * 1000)

  const bookings: Booking[] = [
    {
      id: 'booking-seed-1',
      ownerId: owner.id,
      eventTypeId: 'meeting-15',
      slotStartAt: seedStartAt.toISOString(),
      slotEndAt: seedEndAt.toISOString(),
      guestName: 'Иван Петров',
      guestEmail: 'ivan@example.com',
      status: 'confirmed',
      createdAt: new Date().toISOString()
    }
  ]

  return {
    owner,
    eventTypes,
    bookings
  }
}
