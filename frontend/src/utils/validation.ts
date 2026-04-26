import { z } from 'zod'

const requiredText = z.string().trim().min(1, 'Поле обязательно для заполнения')

const emailSchema = z.string().trim().email('Укажите корректный email')

const idSchema = z
  .string()
  .trim()
  .min(3, 'Минимальная длина идентификатора: 3 символа')

const durationSchema = z.coerce
  .number()
  .int('Длительность должна быть целым числом')
  .min(5, 'Минимальная длительность: 5 минут')
  .max(480, 'Максимальная длительность: 480 минут')

export const bookingSchema = z.object({
  eventTypeId: requiredText,
  slotStartAt: requiredText,
  guestName: requiredText,
  guestEmail: emailSchema
})

export const eventTypeSchema = z.object({
  id: idSchema,
  name: requiredText,
  description: requiredText,
  durationMinutes: durationSchema
})

export type BookingFormInput = z.input<typeof bookingSchema>
export type CreateBookingPayload = z.output<typeof bookingSchema>
export type EventTypeFormInput = z.input<typeof eventTypeSchema>
export type CreateEventTypePayload = z.output<typeof eventTypeSchema>

export function parseBookingPayload(
  input: BookingFormInput
): CreateBookingPayload {
  return bookingSchema.parse(input)
}

export function parseEventTypePayload(
  input: EventTypeFormInput
): CreateEventTypePayload {
  return eventTypeSchema.parse(input)
}

export function getValidationMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Ошибка валидации'
  }

  return 'Не удалось проверить данные формы'
}
