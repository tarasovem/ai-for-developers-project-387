import { describe, expect, it } from 'vitest'

import { isSlotConflict, normalizeApiError } from './errors'

describe('normalizeApiError', () => {
  it('извлекает код и сообщение из ErrorBody', () => {
    const error = normalizeApiError(409, {
      error: {
        code: 'SlotConflictError',
        message: 'Слот уже занят',
        details: 'Конфликт бронирования'
      }
    })

    expect(error.status).toBe(409)
    expect(error.code).toBe('SlotConflictError')
    expect(error.message).toBe('Слот уже занят')
    expect(error.details).toBe('Конфликт бронирования')
  })

  it('возвращает fallback для неожиданного payload', () => {
    const error = normalizeApiError(500, { unexpected: true })

    expect(error.status).toBe(500)
    expect(error.code).toBe('HTTP_500')
  })
})

describe('isSlotConflict', () => {
  it('распознает конфликт по статусу 409', () => {
    expect(
      isSlotConflict({
        status: 409,
        code: 'HTTP_409',
        message: 'Conflict'
      })
    ).toBe(true)
  })

  it('распознает конфликт по коду SlotConflictError', () => {
    expect(
      isSlotConflict({
        status: 400,
        code: 'SlotConflictError',
        message: 'Conflict'
      })
    ).toBe(true)
  })
})
