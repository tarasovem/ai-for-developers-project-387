import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { ApiError } from '../errors/api-error.js'
import type { InMemoryStore } from '../repositories/in-memory-store.js'
import { addDays, startOfUtcDay, toIso } from '../utils/date.js'
import type {
  Booking,
  CreateBookingRequest,
  CreateEventTypeRequest,
  EventType,
  Slot
} from '../types.js'

const WINDOW_DAYS = 14
const SLOT_HOURS = [9, 13, 16]

const createEventTypeSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  durationMinutes: z.number().int().min(1).max(2_147_483_647)
})

const createBookingSchema = z.object({
  eventTypeId: z.string().trim().min(1),
  slotStartAt: z.string().trim().min(1),
  guestName: z.string().trim().min(1),
  guestEmail: z.string().trim().email()
})

export class BookingService {
  private readonly store: InMemoryStore
  private readonly getNow: () => Date

  constructor(store: InMemoryStore, getNow: () => Date = () => new Date()) {
    this.store = store
    this.getNow = getNow
  }

  getDefaultOwner() {
    return structuredClone(this.store.owner)
  }

  listPublicEventTypes() {
    return structuredClone(this.store.eventTypes)
  }

  listAdminEventTypes() {
    return structuredClone(this.store.eventTypes)
  }

  listPublicSlots(eventTypeId: string, from?: string, to?: string): Slot[] {
    const eventType = this.findEventTypeOrThrow(eventTypeId)
    const window = this.parseWindowRange(from, to)
    const fromDay = startOfUtcDay(window.from)
    const toDay = startOfUtcDay(window.to)

    const slots: Slot[] = []
    for (
      let day = new Date(fromDay);
      day.getTime() <= toDay.getTime();
      day = addDays(day, 1)
    ) {
      for (const hour of SLOT_HOURS) {
        const slotStart = new Date(
          Date.UTC(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            hour,
            0,
            0,
            0
          )
        )

        if (slotStart.getTime() < window.from.getTime()) {
          continue
        }
        if (slotStart.getTime() > window.to.getTime()) {
          continue
        }

        const slotEnd = new Date(
          slotStart.getTime() + eventType.durationMinutes * 60 * 1000
        )
        const isAvailable = !this.hasConflict(slotStart, slotEnd)

        slots.push({
          eventTypeId,
          startAt: toIso(slotStart),
          endAt: toIso(slotEnd),
          isAvailable
        })
      }
    }

    return slots
  }

  createPublicBooking(payload: CreateBookingRequest): Booking {
    const parsedPayload = this.parseCreateBookingPayload(payload)
    const eventType = this.findEventTypeOrThrow(parsedPayload.eventTypeId)
    const slotStartAt = this.parseDateOrThrow(
      parsedPayload.slotStartAt,
      'slotStartAt'
    )
    const slotEndAt = new Date(
      slotStartAt.getTime() + eventType.durationMinutes * 60 * 1000
    )

    if (this.hasConflict(slotStartAt, slotEndAt)) {
      throw new ApiError(
        409,
        'SlotConflictError',
        'Выбранный слот уже занят'
      )
    }

    const booking: Booking = {
      id: randomUUID(),
      ownerId: this.store.owner.id,
      eventTypeId: parsedPayload.eventTypeId,
      slotStartAt: toIso(slotStartAt),
      slotEndAt: toIso(slotEndAt),
      guestName: parsedPayload.guestName,
      guestEmail: parsedPayload.guestEmail,
      status: 'confirmed',
      createdAt: toIso(this.getNow())
    }

    this.store.bookings.push(booking)
    return structuredClone(booking)
  }

  createAdminEventType(payload: CreateEventTypeRequest): EventType {
    const parsedPayload = this.parseCreateEventTypePayload(payload)
    const exists = this.store.eventTypes.some(
      (eventType) => eventType.id === parsedPayload.id
    )

    if (exists) {
      throw new ApiError(
        400,
        'BadRequestError',
        'Тип события с таким id уже существует'
      )
    }

    const eventType: EventType = {
      id: parsedPayload.id,
      name: parsedPayload.name,
      description: parsedPayload.description,
      durationMinutes: parsedPayload.durationMinutes
    }

    this.store.eventTypes.push(eventType)
    return structuredClone(eventType)
  }

  listUpcomingBookings(from?: string, to?: string): Booking[] {
    const now = this.getNow()
    const fromDate = from ? this.parseDateOrThrow(from, 'from') : now
    const toDate = to ? this.parseDateOrThrow(to, 'to') : null

    if (toDate && fromDate.getTime() > toDate.getTime()) {
      throw new ApiError(
        400,
        'BadRequestError',
        'Параметр from должен быть меньше или равен to'
      )
    }

    const bookings = this.store.bookings
      .filter((booking) => {
        const bookingStartAt = new Date(booking.slotStartAt).getTime()
        if (bookingStartAt < fromDate.getTime()) {
          return false
        }
        if (toDate && bookingStartAt > toDate.getTime()) {
          return false
        }
        return true
      })
      .sort(
        (left, right) =>
          new Date(left.slotStartAt).getTime() -
          new Date(right.slotStartAt).getTime()
      )

    return structuredClone(bookings)
  }

  private parseCreateEventTypePayload(
    payload: CreateEventTypeRequest
  ): CreateEventTypeRequest {
    const parsed = createEventTypeSchema.safeParse(payload)
    if (!parsed.success) {
      throw new ApiError(
        400,
        'BadRequestError',
        'Некорректное тело запроса для создания типа события',
        z.prettifyError(parsed.error)
      )
    }
    return parsed.data
  }

  private parseCreateBookingPayload(
    payload: CreateBookingRequest
  ): CreateBookingRequest {
    const parsed = createBookingSchema.safeParse(payload)
    if (!parsed.success) {
      throw new ApiError(
        400,
        'BadRequestError',
        'Некорректное тело запроса для создания бронирования',
        z.prettifyError(parsed.error)
      )
    }
    return parsed.data
  }

  private parseWindowRange(from?: string, to?: string): { from: Date; to: Date } {
    const now = this.getNow()
    const defaultFrom = now
    const defaultTo = addDays(now, WINDOW_DAYS)
    const fromDate = from ? this.parseDateOrThrow(from, 'from') : defaultFrom
    const toDate = to ? this.parseDateOrThrow(to, 'to') : defaultTo

    if (fromDate.getTime() > toDate.getTime()) {
      throw new ApiError(
        400,
        'BadRequestError',
        'Параметр from должен быть меньше или равен to'
      )
    }

    return {
      from: fromDate,
      to: toDate
    }
  }

  private parseDateOrThrow(value: string, field: string): Date {
    const parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(
        400,
        'BadRequestError',
        `Параметр ${field} должен быть валидной датой в UTC ISO формате`
      )
    }
    return parsedDate
  }

  private findEventTypeOrThrow(eventTypeId: string): EventType {
    const eventType = this.store.eventTypes.find((item) => item.id === eventTypeId)
    if (!eventType) {
      throw new ApiError(404, 'NotFoundError', 'Тип события не найден')
    }
    return eventType
  }

  private hasConflict(slotStartAt: Date, slotEndAt: Date): boolean {
    return this.store.bookings.some((booking) => {
      if (booking.status !== 'confirmed') {
        return false
      }

      const bookingStartAt = new Date(booking.slotStartAt)
      const bookingEndAt = new Date(booking.slotEndAt)

      return (
        slotStartAt.getTime() < bookingEndAt.getTime() &&
        bookingStartAt.getTime() < slotEndAt.getTime()
      )
    })
  }
}
