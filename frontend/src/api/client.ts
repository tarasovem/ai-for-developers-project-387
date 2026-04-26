import type {
  ApiClient,
  Booking,
  CreateBookingRequest,
  CreateEventTypeRequest,
  EventType,
  Owner,
  Slot
} from '../types/api'
import { HttpClient } from './http-client'
import { createMockApiClient } from './mock-api'

interface PublicEventTypesOk {
  eventTypes: EventType[]
}

interface PublicSlotsOk {
  slots: Slot[]
}

interface BookingCreated {
  booking: Booking
}

interface OwnerOk {
  owner: Owner
}

interface AdminEventTypesOk {
  eventTypes: EventType[]
}

interface EventTypeCreated {
  eventType: EventType
}

interface UpcomingBookingsOk {
  bookings: Booking[]
}

class RestApiClient implements ApiClient {
  private readonly http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  async listPublicEventTypes(): Promise<EventType[]> {
    const response = await this.http.get<PublicEventTypesOk>(
      '/public/event-types'
    )
    return response.eventTypes
  }

  async listPublicSlots(
    eventTypeId: string,
    from?: string,
    to?: string
  ): Promise<Slot[]> {
    const query: Record<string, string> = {}
    if (from) {
      query.from = from
    }
    if (to) {
      query.to = to
    }

    const response = await this.http.get<PublicSlotsOk>(
      `/public/event-types/${eventTypeId}/slots`,
      Object.keys(query).length > 0 ? query : undefined
    )
    return response.slots
  }

  async createPublicBooking(payload: CreateBookingRequest): Promise<Booking> {
    const response = await this.http.post<BookingCreated, CreateBookingRequest>(
      '/public/bookings',
      payload
    )
    return response.booking
  }

  async getDefaultOwner(): Promise<Owner> {
    const response = await this.http.get<OwnerOk>('/admin/owner')
    return response.owner
  }

  async listAdminEventTypes(): Promise<EventType[]> {
    const response =
      await this.http.get<AdminEventTypesOk>('/admin/event-types')
    return response.eventTypes
  }

  async createAdminEventType(
    payload: CreateEventTypeRequest
  ): Promise<EventType> {
    const response = await this.http.post<
      EventTypeCreated,
      CreateEventTypeRequest
    >('/admin/event-types', payload)
    return response.eventType
  }

  async listUpcomingBookings(from?: string, to?: string): Promise<Booking[]> {
    const query: Record<string, string> = {}
    if (from) {
      query.from = from
    }
    if (to) {
      query.to = to
    }

    const response = await this.http.get<UpcomingBookingsOk>(
      '/admin/bookings/upcoming',
      Object.keys(query).length > 0 ? query : undefined
    )
    return response.bookings
  }
}

function shouldUseMockApi(): boolean {
  const env = import.meta.env
  if (env.VITE_USE_MOCK_API === 'true') {
    return true
  }

  return !env.VITE_API_BASE_URL
}

export function createApiClient(): ApiClient {
  if (shouldUseMockApi()) {
    return createMockApiClient()
  }

  return new RestApiClient(new HttpClient(import.meta.env.VITE_API_BASE_URL))
}
