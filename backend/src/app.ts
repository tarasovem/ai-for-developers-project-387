import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'

import { ApiError, toErrorBody } from './errors/api-error.js'
import {
  createInMemoryStore,
  type InMemoryStore
} from './repositories/in-memory-store.js'
import { registerAdminRoutes } from './routes/admin.js'
import { registerPublicRoutes } from './routes/public.js'
import { BookingService } from './services/booking-service.js'

interface CreateAppOptions {
  store?: InMemoryStore
  getNow?: () => Date
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: false
  })

  const store = options.store ?? createInMemoryStore()
  const bookingService = new BookingService(store, options.getNow)

  app.get('/', async () => ({
    status: 'ok',
    service: 'booking-api'
  }))

  app.register(cors, {
    origin: true
  })

  app.register(async (publicApp) => {
    registerPublicRoutes(publicApp, bookingService)
  }, { prefix: '/public' })

  app.register(async (adminApp) => {
    registerAdminRoutes(adminApp, bookingService)
  }, { prefix: '/admin' })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      reply.status(error.status).send(toErrorBody(error))
      return
    }

    reply.status(500).send({
      error: {
        code: 'InternalServerError',
        message: 'Внутренняя ошибка сервера'
      }
    })
  })

  return app
}
