import type { FastifyInstance } from 'fastify'

import { BookingService } from '../services/booking-service.js'
import type { CreateBookingRequest } from '../types.js'

interface PublicSlotsParams {
  eventTypeId: string
}

interface PublicSlotsQuery {
  from?: string
  to?: string
}

export function registerPublicRoutes(
  app: FastifyInstance,
  bookingService: BookingService
): void {
  app.get('/event-types', async () => {
    return {
      eventTypes: bookingService.listPublicEventTypes()
    }
  })

  app.get<{ Params: PublicSlotsParams; Querystring: PublicSlotsQuery }>(
    '/event-types/:eventTypeId/slots',
    async (request) => {
      const slots = bookingService.listPublicSlots(
        request.params.eventTypeId,
        request.query.from,
        request.query.to
      )

      return {
        slots
      }
    }
  )

  app.post<{ Body: CreateBookingRequest }>('/bookings', async (request, reply) => {
    const booking = bookingService.createPublicBooking(request.body)
    reply.status(201)
    return { booking }
  })
}
