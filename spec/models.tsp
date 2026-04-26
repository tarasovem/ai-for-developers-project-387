import "@typespec/http";

using TypeSpec.Http;

namespace CalendarBooking.V1;

@doc("Заранее заданный профиль владельца календаря, который используется в админской части без авторизации.")
model Owner {
  id: string;
  displayName: string;
  timezone: string;
  isDefaultProfile: boolean;
}

@doc("Тип события, который можно выбрать для бронирования.")
model EventType {
  id: string;
  name: string;
  description: string;
  durationMinutes: int32;
}

@doc("Свободный или занятый слот для конкретного типа события.")
model Slot {
  eventTypeId: string;
  startAt: utcDateTime;
  endAt: utcDateTime;
  isAvailable: boolean;
}

enum BookingStatus {
  confirmed,
  cancelled
}

@doc("Созданное бронирование на выбранный временной слот.")
model Booking {
  id: string;
  ownerId: string;
  eventTypeId: string;
  slotStartAt: utcDateTime;
  slotEndAt: utcDateTime;
  guestName: string;
  guestEmail: string;
  status: BookingStatus;
  createdAt: utcDateTime;
}

model ErrorBody {
  code: string;
  message: string;
  details?: string;
}

model BadRequestError {
  @statusCode statusCode: 400;
  error: ErrorBody;
}

model NotFoundError {
  @statusCode statusCode: 404;
  error: ErrorBody;
}

model SlotConflictError {
  @statusCode statusCode: 409;
  error: ErrorBody;
}

model PublicEventTypesOk {
  @statusCode statusCode: 200;
  eventTypes: EventType[];
}

model PublicSlotsOk {
  @statusCode statusCode: 200;
  slots: Slot[];
}

model BookingCreated {
  @statusCode statusCode: 201;
  booking: Booking;
}

model OwnerOk {
  @statusCode statusCode: 200;
  owner: Owner;
}

model AdminEventTypesOk {
  @statusCode statusCode: 200;
  eventTypes: EventType[];
}

model EventTypeCreated {
  @statusCode statusCode: 201;
  eventType: EventType;
}

model UpcomingBookingsOk {
  @statusCode statusCode: 200;
  bookings: Booking[];
}

@doc("Данные для создания нового типа события в админской части.")
model CreateEventTypeRequest {
  id: string;
  name: string;
  description: string;
  durationMinutes: int32;
}

@doc("Данные гостя и слота для создания бронирования.")
model CreateBookingRequest {
  eventTypeId: string;
  slotStartAt: utcDateTime;
  guestName: string;
  guestEmail: string;
}
