import type { FastifyInstance } from 'fastify'

import { BookingService } from '../services/booking-service.js'
import type { CreateEventTypeRequest } from '../types.js'

interface UpcomingBookingsQuery {
  from?: string
  to?: string
}

export function registerAdminRoutes(
  app: FastifyInstance,
  bookingService: BookingService
): void {
  app.get('/owner', async () => {
    return {
      owner: bookingService.getDefaultOwner()
    }
  })

  app.get('/event-types', async () => {
    return {
      eventTypes: bookingService.listAdminEventTypes()
    }
  })

  app.post<{ Body: CreateEventTypeRequest }>(
    '/event-types',
    async (request, reply) => {
      const eventType = bookingService.createAdminEventType(request.body)
      reply.status(201)
      return { eventType }
    }
  )

  app.get<{ Querystring: UpcomingBookingsQuery }>(
    '/bookings/upcoming',
    async (request) => {
      const bookings = bookingService.listUpcomingBookings(
        request.query.from,
        request.query.to
      )
      return { bookings }
    }
  )
}
