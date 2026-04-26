import type { ErrorBody } from '../types.js'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: string

  constructor(status: number, code: string, message: string, details?: string) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function toErrorBody(error: ApiError): { error: ErrorBody } {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  }
}
