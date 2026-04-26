import supertest from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { createInMemoryStore } from '../src/repositories/in-memory-store.js'

describe('Calendar Booking API', () => {
  let app: ReturnType<typeof createApp>
  let request: ReturnType<typeof supertest>

  beforeEach(async () => {
    app = createApp({
      store: createInMemoryStore()
    })
    await app.ready()
    request = supertest(app.server)
  })

  afterEach(async () => {
    await app.close()
  })

  it('создает бронирование на свободный слот', async () => {
    const eventTypesResponse = await request.get('/public/event-types')
    expect(eventTypesResponse.status).toBe(200)
    const eventTypeId = eventTypesResponse.body.eventTypes[0]?.id as string

    const slotsResponse = await request
      .get(`/public/event-types/${eventTypeId}/slots`)
      .query({
        from: '2099-01-01T00:00:00.000Z',
        to: '2099-01-02T23:59:59.000Z'
      })

    expect(slotsResponse.status).toBe(200)
    const freeSlot = slotsResponse.body.slots.find(
      (slot: { isAvailable: boolean }) => slot.isAvailable
    ) as { startAt: string } | undefined
    expect(freeSlot).toBeDefined()

    const createResponse = await request.post('/public/bookings').send({
      eventTypeId,
      slotStartAt: freeSlot?.startAt,
      guestName: 'Тестовый гость',
      guestEmail: 'guest@example.com'
    })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.booking.eventTypeId).toBe(eventTypeId)
    expect(createResponse.body.booking.guestEmail).toBe('guest@example.com')
    expect(createResponse.body.booking.status).toBe('confirmed')
  })

  it('возвращает 409, если слот уже занят для другого типа события', async () => {
    const eventTypesResponse = await request.get('/public/event-types')
    const firstEventTypeId = eventTypesResponse.body.eventTypes[0]?.id as string
    const secondEventTypeId = eventTypesResponse.body.eventTypes[1]?.id as string

    const slotsResponse = await request
      .get(`/public/event-types/${firstEventTypeId}/slots`)
      .query({
        from: '2099-02-01T00:00:00.000Z',
        to: '2099-02-02T23:59:59.000Z'
      })

    const freeSlot = slotsResponse.body.slots.find(
      (slot: { isAvailable: boolean }) => slot.isAvailable
    ) as { startAt: string } | undefined
    expect(freeSlot).toBeDefined()

    const firstBookingResponse = await request.post('/public/bookings').send({
      eventTypeId: firstEventTypeId,
      slotStartAt: freeSlot?.startAt,
      guestName: 'Первый',
      guestEmail: 'first@example.com'
    })
    expect(firstBookingResponse.status).toBe(201)

    const secondBookingResponse = await request.post('/public/bookings').send({
      eventTypeId: secondEventTypeId,
      slotStartAt: freeSlot?.startAt,
      guestName: 'Второй',
      guestEmail: 'second@example.com'
    })

    expect(secondBookingResponse.status).toBe(409)
    expect(secondBookingResponse.body.error.code).toBe('SlotConflictError')
  })

  it('возвращает 404 для неизвестного eventType в слотах', async () => {
    const response = await request.get('/public/event-types/unknown/slots')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NotFoundError')
  })

  it('возвращает 400 для невалидного from в upcoming', async () => {
    const response = await request
      .get('/admin/bookings/upcoming')
      .query({ from: 'invalid-date' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('BadRequestError')
  })

  it('фильтрует upcoming бронирования по from/to', async () => {
    const eventTypesResponse = await request.get('/public/event-types')
    const eventTypeId = eventTypesResponse.body.eventTypes[0]?.id as string

    const createResponse = await request.post('/public/bookings').send({
      eventTypeId,
      slotStartAt: '2099-03-10T09:00:00.000Z',
      guestName: 'Гость',
      guestEmail: 'guest-filter@example.com'
    })
    expect(createResponse.status).toBe(201)

    const response = await request.get('/admin/bookings/upcoming').query({
      from: '2099-03-10T00:00:00.000Z',
      to: '2099-03-10T23:59:59.000Z'
    })

    expect(response.status).toBe(200)
    const matches = response.body.bookings.filter(
      (booking: { guestEmail: string }) =>
        booking.guestEmail === 'guest-filter@example.com'
    )
    expect(matches.length).toBe(1)
  })
})
