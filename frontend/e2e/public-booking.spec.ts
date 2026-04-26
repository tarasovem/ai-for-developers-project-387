import { expect, test, type Page } from '@playwright/test'

interface SelectedSlot {
  dayIndex: number
  timeRange: string
}

const backendBaseUrl = 'http://127.0.0.1:3000'

async function openEventTypeStep(page: Page): Promise<void> {
  await page.goto('/public')
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  await page.getByRole('button', { name: 'Записаться' }).first().click()
  await page.getByRole('button', { name: /Встреча 15 минут/i }).first().click()
}

async function selectFirstAvailableSlot(page: Page): Promise<SelectedSlot> {
  const dayButtons = page.locator('.calendar-day:not(.disabled)')
  const dayCount = await dayButtons.count()

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    await dayButtons.nth(dayIndex).click()

    const freeSlot = page.locator('.slot-row').filter({ hasText: 'Свободно' }).first()
    if ((await freeSlot.count()) === 0) {
      continue
    }

    const timeRange = (await freeSlot.locator('span').first().textContent())?.trim() ?? ''
    await freeSlot.click()

    if (!timeRange) {
      throw new Error('Не удалось определить время выбранного слота')
    }

    return {
      dayIndex,
      timeRange
    }
  }

  throw new Error('Не найден доступный слот для бронирования')
}

async function openConfirmationStep(
  page: Page,
  guestName: string,
  guestEmail: string
): Promise<SelectedSlot> {
  await openEventTypeStep(page)
  const selectedSlot = await selectFirstAvailableSlot(page)
  await page.getByRole('button', { name: 'Продолжить' }).click()

  await page.locator('input[name="guestName"]').fill(guestName)
  await page.locator('input[name="guestEmail"]').fill(guestEmail)

  return selectedSlot
}

test('гость может создать бронирование', async ({ page }) => {
  await openConfirmationStep(
    page,
    'Тестовый Гость',
    `guest${Date.now()}@example.com`
  )
  await page.getByRole('button', { name: 'Забронировать' }).click()

  await expect(page.getByText('Бронирование успешно создано.')).toBeVisible()
})

test('форма показывает ошибку при невалидном email', async ({ page }) => {
  await openConfirmationStep(page, 'Гость проверки', 'invalid-email')

  // Отправляем событие submit вручную, чтобы проверить сообщение из zod-валидации.
  await page.locator('.booking-form').evaluate((formElement) => {
    formElement.dispatchEvent(
      new SubmitEvent('submit', {
        bubbles: true,
        cancelable: true
      })
    )
  })

  await expect(page.getByText('Укажите корректный email')).toBeVisible()
  await expect(page.getByText('Бронирование успешно создано.')).toHaveCount(0)
})

test('при конфликте слота пользователь возвращается к выбору времени', async ({
  page,
  request
}) => {
  const eventTypesResponse = await request.get(`${backendBaseUrl}/public/event-types`)
  const eventTypesPayload = (await eventTypesResponse.json()) as {
    eventTypes: Array<{ id: string }>
  }
  const eventTypeId = eventTypesPayload.eventTypes[0]?.id
  if (!eventTypeId) {
    throw new Error('Не удалось получить тип события для e2e-теста')
  }

  const slotsResponse = await request.get(
    `${backendBaseUrl}/public/event-types/${eventTypeId}/slots`
  )
  const slotsPayload = (await slotsResponse.json()) as {
    slots: Array<{ startAt: string; endAt: string; isAvailable: boolean }>
  }

  const slotsByDate = new Map<
    string,
    Array<{ startAt: string; endAt: string; isAvailable: boolean }>
  >()
  for (const slot of slotsPayload.slots) {
    const dateKey = slot.startAt.slice(0, 10)
    const slotsForDate = slotsByDate.get(dateKey) ?? []
    slotsForDate.push(slot)
    slotsByDate.set(dateKey, slotsForDate)
  }

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let targetDateKey = ''
  let targetSlot: { startAt: string; endAt: string; isAvailable: boolean } | null = null
  for (const dateKey of Array.from(slotsByDate.keys()).sort()) {
    const date = new Date(`${dateKey}T00:00:00`)
    if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) {
      continue
    }

    const freeSlot = slotsByDate.get(dateKey)?.find((slot) => slot.isAvailable) ?? null
    if (freeSlot) {
      targetDateKey = dateKey
      targetSlot = freeSlot
      break
    }
  }

  if (!targetSlot || !targetDateKey) {
    throw new Error('Не удалось найти свободный слот для проверки конфликта')
  }

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit'
  }
  const targetTimeRange = `${new Date(targetSlot.startAt).toLocaleTimeString('ru-RU', timeOptions)} - ${new Date(targetSlot.endAt).toLocaleTimeString('ru-RU', timeOptions)}`
  const targetDayNumber = String(new Date(`${targetDateKey}T00:00:00`).getDate())

  await openEventTypeStep(page)
  await page.locator('.calendar-day', { hasText: targetDayNumber }).click()

  const targetSlotButton = page
    .locator('.slot-row')
    .filter({ hasText: targetTimeRange })
    .filter({ hasText: 'Свободно' })
    .first()
  await expect(targetSlotButton).toBeVisible()
  await targetSlotButton.click()

  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.locator('input[name="guestName"]').fill('Первый пользователь')
  await page
    .locator('input[name="guestEmail"]')
    .fill(`first${Date.now()}@example.com`)

  const bookingByAnotherGuest = await request.post(`${backendBaseUrl}/public/bookings`, {
    data: {
      eventTypeId,
      slotStartAt: targetSlot.startAt,
      guestName: 'Конкурент',
      guestEmail: `competitor${Date.now()}@example.com`
    }
  })
  expect(bookingByAnotherGuest.status()).toBe(201)

  const bookingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/public/bookings') &&
      response.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Забронировать' }).click()
  const bookingResponse = await bookingResponsePromise

  expect(bookingResponse.status()).toBe(409)
  await expect(page.getByRole('heading', { name: 'Статус слотов' })).toBeVisible()
})
