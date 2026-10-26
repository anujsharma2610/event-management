/**
 * Resilient API client for Event Management REST API.
 */

import {
  ApiErrorDetail,
  ApiErrorPayload,
  Event,
  EventListResponse,
  EventWrite,
  ListRegistrationsResponse,
  RegisterResponse,
} from './types'

export class ApiError extends Error {
  public status: number
  public code: string
  public details: ApiErrorDetail[]

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(
  /\/+$/,
  '',
)

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const headers = new Headers(options.headers || {})

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Unable to connect to the server. Please check your connection or backend status.',
    )
  }

  // Handle 204 No Content safely without parsing JSON
  if (response.status === 204) {
    return undefined as unknown as T
  }

  if (!response.ok) {
    let errorPayload: ApiErrorPayload | null = null
    try {
      errorPayload = (await response.json()) as ApiErrorPayload
    } catch {
      // Body was not JSON
    }

    if (errorPayload?.error) {
      throw new ApiError(
        response.status,
        errorPayload.error.code,
        errorPayload.error.message,
        errorPayload.error.details || [],
      )
    }

    throw new ApiError(
      response.status,
      `HTTP_${response.status}`,
      `Request failed with status ${response.status}`,
    )
  }

  return (await response.json()) as T
}

export const apiClient = {
  getEvents: (signal?: AbortSignal): Promise<EventListResponse> =>
    request<EventListResponse>('/api/events', { method: 'GET', signal }),

  getEvent: (id: string, signal?: AbortSignal): Promise<Event> =>
    request<Event>(`/api/events/${encodeURIComponent(id)}`, { method: 'GET', signal }),

  createEvent: (data: EventWrite): Promise<Event> =>
    request<Event>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEvent: (id: string, data: EventWrite): Promise<Event> =>
    request<Event>(`/api/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteEvent: (id: string): Promise<void> =>
    request<void>(`/api/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getRegistrations: (eventId: string, signal?: AbortSignal): Promise<ListRegistrationsResponse> =>
    request<ListRegistrationsResponse>(
      `/api/events/${encodeURIComponent(eventId)}/registrations`,
      { method: 'GET', signal },
    ),

  registerAttendee: (eventId: string, userId: string): Promise<RegisterResponse> =>
    request<RegisterResponse>(
      `/api/events/${encodeURIComponent(eventId)}/registrations`,
      {
        method: 'POST',
        body: JSON.stringify({ userId }),
      },
    ),

  unregisterAttendee: (eventId: string, userId: string): Promise<void> =>
    request<void>(
      `/api/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      },
    ),
}
