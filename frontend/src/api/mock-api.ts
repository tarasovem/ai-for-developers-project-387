import type {
  ApiClient,
  Booking,
  CreateBookingRequest,
  CreateEventTypeRequest,
  EventType,
  Owner,
  Slot
} from '../types/api'
import type { ApiError } from './errors'
import { addDays, getDefaultWindow, toIso } from '../utils/date'

const owner: Owner = {
  id: 'owner-default',
  displayName: 'Tota',
  timezone: 'Europe/Moscow',
  isDefaultProfile: true
}

const eventTypesStore: EventType[] = [
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

const bookingsStore: Booking[] = [
  {
    id: 'booking-seed-1',
    ownerId: owner.id,
    eventTypeId: 'meeting-15',
    slotStartAt: addDays(new Date(), 1).toISOString(),
    slotEndAt: addDays(new Date(Date.now() + 30 * 60 * 1000), 1).toISOString(),
    guestName: 'Иван Петров',
    guestEmail: 'ivan@example.com',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  }
]

function createApiError(
  status: number,
  code: string,
  message: string,
  details?: string
): ApiError {
  return { status, code, message, details }
}

function getSlotsForWindow(
  eventType: EventType,
  from?: string,
  to?: string
): Slot[] {
  const fallback = getDefaultWindow()
  const fromDate = new Date(from ?? fallback.from)
  const toDate = new Date(to ?? fallback.to)

  const slots: Slot[] = []
  const slotHours = [9, 13, 16]

  for (
    let day = new Date(fromDate);
    day.getTime() <= toDate.getTime();
    day = addDays(day, 1)
  ) {
    slotHours.forEach((hour) => {
      const start = new Date(
        Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          hour,
          0,
          0
        )
      )
      const end = new Date(
        start.getTime() + eventType.durationMinutes * 60 * 1000
      )

      const hasConflict = bookingsStore.some(
        (booking) =>
          booking.slotStartAt === start.toISOString() &&
          booking.status === 'confirmed'
      )

      slots.push({
        eventTypeId: eventType.id,
        startAt: toIso(start),
        endAt: toIso(end),
        isAvailable: !hasConflict
      })
    })
  }

  return slots
}

export function createMockApiClient(): ApiClient {
  return {
    async listPublicEventTypes() {
      return structuredClone(eventTypesStore)
    },
    async listPublicSlots(eventTypeId, from, to) {
      const eventType = eventTypesStore.find((item) => item.id === eventTypeId)
      if (!eventType) {
        throw createApiError(404, 'NotFoundError', 'Тип события не найден')
      }

      return getSlotsForWindow(eventType, from, to)
    },
    async createPublicBooking(payload: CreateBookingRequest) {
      const eventType = eventTypesStore.find(
        (item) => item.id === payload.eventTypeId
      )
      if (!eventType) {
        throw createApiError(
          404,
          'NotFoundError',
          'Тип события для бронирования не найден'
        )
      }

      const hasConflict = bookingsStore.some(
        (booking) =>
          booking.slotStartAt === payload.slotStartAt &&
          booking.status === 'confirmed'
      )

      if (hasConflict) {
        throw createApiError(
          409,
          'SlotConflictError',
          'Выбранный слот уже занят'
        )
      }

      const slotStart = new Date(payload.slotStartAt)
      const slotEnd = new Date(
        slotStart.getTime() + eventType.durationMinutes * 60 * 1000
      )

      const booking: Booking = {
        id: crypto.randomUUID(),
        ownerId: owner.id,
        eventTypeId: payload.eventTypeId,
        slotStartAt: payload.slotStartAt,
        slotEndAt: slotEnd.toISOString(),
        guestName: payload.guestName,
        guestEmail: payload.guestEmail,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      }

      bookingsStore.push(booking)
      return structuredClone(booking)
    },
    async getDefaultOwner() {
      return structuredClone(owner)
    },
    async listAdminEventTypes() {
      return structuredClone(eventTypesStore)
    },
    async createAdminEventType(payload: CreateEventTypeRequest) {
      const exists = eventTypesStore.some((item) => item.id === payload.id)
      if (exists) {
        throw createApiError(
          400,
          'BadRequestError',
          'Тип события с таким id уже существует'
        )
      }

      const eventType: EventType = {
        id: payload.id,
        name: payload.name,
        description: payload.description,
        durationMinutes: payload.durationMinutes
      }
      eventTypesStore.push(eventType)

      return structuredClone(eventType)
    },
    async listUpcomingBookings(from, to) {
      const fromDate = from ? new Date(from).getTime() : Date.now()
      const toDate = to ? new Date(to).getTime() : Number.POSITIVE_INFINITY

      const upcoming = bookingsStore.filter((booking) => {
        const start = new Date(booking.slotStartAt).getTime()
        return start >= fromDate && start <= toDate
      })

      return structuredClone(
        upcoming.sort(
          (left, right) =>
            new Date(left.slotStartAt).getTime() -
            new Date(right.slotStartAt).getTime()
        )
      )
    }
  }
}
