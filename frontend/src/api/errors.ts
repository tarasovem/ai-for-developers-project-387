export interface ApiError {
  status: number
  code: string
  message: string
  details?: string
}

export function normalizeApiError(status: number, payload: unknown): ApiError {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'code' in payload.error &&
    'message' in payload.error
  ) {
    const error = payload.error as Record<string, unknown>
    return {
      status,
      code: String(error.code),
      message: String(error.message),
      details: typeof error.details === 'string' ? error.details : undefined
    }
  }

  return {
    status,
    code: `HTTP_${status}`,
    message: 'Не удалось обработать ответ сервера'
  }
}

export function isSlotConflict(error: ApiError | null): boolean {
  return error?.status === 409 || error?.code === 'SlotConflictError'
}
