import type { ApiError } from './errors'
import { normalizeApiError } from './errors'

type Method = 'GET' | 'POST'

export class HttpClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, query)
  }

  async post<T, TBody>(path: string, body: TBody): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  private async request<T>(
    method: Method,
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const payload = await this.safeParseJson(response)
    if (!response.ok) {
      throw normalizeApiError(response.status, payload)
    }

    return payload as T
  }

  private async safeParseJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      const fallbackError: ApiError = {
        status: response.status,
        code: `HTTP_${response.status}`,
        message: 'Сервер вернул некорректный JSON'
      }
      return { error: fallbackError }
    }
  }
}
