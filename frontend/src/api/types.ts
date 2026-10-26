/**
 * TypeScript types and interfaces matching the backend REST API contracts.
 */

export type EventStatus = 'upcoming' | 'full' | 'past'

export interface Event {
  id: string
  title: string
  description: string
  date: string // ISO 8601 UTC string
  maxCapacity: number
  registrationCount: number
  remainingCapacity: number
  status: EventStatus
  createdAt: string
  updatedAt: string
}

export interface EventWrite {
  title: string
  description: string
  date: string // ISO 8601 UTC string
  maxCapacity: number
}

export interface EventListResponse {
  items: Event[]
  total: number
}

export interface RegistrationItem {
  userId: string
  registeredAt: string
}

export interface ListRegistrationsResponse {
  eventId: string
  items: RegistrationItem[]
  total: number
}

export interface RegisterResponse {
  eventId: string
  userId: string
  registeredAt: string
}

export interface ApiErrorDetail {
  field?: string
  message: string
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    details: ApiErrorDetail[]
  }
}
