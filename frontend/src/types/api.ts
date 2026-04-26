export interface Owner {
  id: string
  displayName: string
  timezone: string
  isDefaultProfile: boolean
}

export interface EventType {
  id: string
  name: string
  description: string
  durationMinutes: number
}

export interface Slot {
  eventTypeId: string
  startAt: string
  endAt: string
  isAvailable: boolean
}

export type BookingStatus = 'confirmed' | 'cancelled'

export interface Booking {
  id: string
  ownerId: string
  eventTypeId: string
  slotStartAt: string
  slotEndAt: string
  guestName: string
  guestEmail: string
  status: BookingStatus
  createdAt: string
}

export interface ErrorBody {
  code: string
  message: string
  details?: string
}

export interface CreateEventTypeRequest {
  id: string
  name: string
  description: string
  durationMinutes: number
}

export interface CreateBookingRequest {
  eventTypeId: string
  slotStartAt: string
  guestName: string
  guestEmail: string
}

export interface ApiClient {
  listPublicEventTypes(): Promise<EventType[]>
  listPublicSlots(
    eventTypeId: string,
    from?: string,
    to?: string
  ): Promise<Slot[]>
  createPublicBooking(payload: CreateBookingRequest): Promise<Booking>
  getDefaultOwner(): Promise<Owner>
  listAdminEventTypes(): Promise<EventType[]>
  createAdminEventType(payload: CreateEventTypeRequest): Promise<EventType>
  listUpcomingBookings(from?: string, to?: string): Promise<Booking[]>
}
