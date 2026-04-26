import { expect, test } from '@playwright/test'

test('админ видит данные и создает тип события', async ({ page }) => {
  await page.goto('/admin')

  await expect(page.getByText('Профиль владельца')).toBeVisible()

  const uniqueId = `new-type-${Date.now()}`
  await page.locator('input[name="id"]').fill(uniqueId)
  await page.locator('input[name="name"]').fill('Новый синк')
  await page
    .locator('input[name="description"]')
    .fill('Синхронизация по статусу проекта')
  await page.locator('input[name="durationMinutes"]').fill('45')
  await page.getByRole('button', { name: 'Создать тип события' }).click()

  await expect(page.getByText('Тип события Новый синк создан.')).toBeVisible()
  await expect(page.getByText(uniqueId)).toBeVisible()
})
