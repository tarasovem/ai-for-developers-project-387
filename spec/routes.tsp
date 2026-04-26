import "@typespec/http";

using TypeSpec.Http;

namespace CalendarBooking.V1;

@tag("Public")
@route("/public")
interface PublicGuestApi {
  @doc("Список типов событий для публичной страницы выбора бронирования.")
  @get
  @route("/event-types")
  op listPublicEventTypes(): PublicEventTypesOk;

  @doc("Список свободных слотов для выбранного типа события. По умолчанию возвращается окно на 14 дней от текущей даты.")
  @get
  @route("/event-types/{eventTypeId}/slots")
  op listPublicSlots(
    @path eventTypeId: string,
    @query from?: utcDateTime,
    @query to?: utcDateTime
  ): PublicSlotsOk | BadRequestError | NotFoundError;

  @doc("Создать бронирование на выбранный свободный слот. Если интервал уже занят, возвращается 409 независимо от типа события.")
  @post
  @route("/bookings")
  op createPublicBooking(
    @body body: CreateBookingRequest
  ): BookingCreated | BadRequestError | NotFoundError | SlotConflictError;
}

@tag("Admin")
@route("/admin")
interface AdminApi {
  @doc("Получить профиль владельца календаря по умолчанию, используемый в админской части.")
  @get
  @route("/owner")
  op getDefaultOwner(): OwnerOk;

  @doc("Получить список всех типов событий владельца.")
  @get
  @route("/event-types")
  op listAdminEventTypes(): AdminEventTypesOk;

  @doc("Создать новый тип события.")
  @post
  @route("/event-types")
  op createAdminEventType(
    @body body: CreateEventTypeRequest
  ): EventTypeCreated | BadRequestError;

  @doc("Получить единый список предстоящих бронирований по всем типам событий.")
  @get
  @route("/bookings/upcoming")
  op listUpcomingBookings(
    @query from?: utcDateTime,
    @query to?: utcDateTime
  ): UpcomingBookingsOk | BadRequestError;
}
