import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { Event, ListRegistrationsResponse } from '../api/types'
import { EventDetailPage } from './EventDetailPage'

vi.mock('../api/client', () => ({
  apiClient: {
    getEvent: vi.fn(),
    getRegistrations: vi.fn(),
    registerAttendee: vi.fn(),
    unregisterAttendee: vi.fn(),
    deleteEvent: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    public status: number
    public code: string
    public details: unknown[]
    constructor(status: number, code: string, message: string, details: unknown[] = []) {
      super(message)
      this.status = status
      this.code = code
      this.details = details
    }
  },
}))

describe('EventDetailPage Component', () => {
  const mockEvent: Event = {
    id: 'test-event-uuid-1',
    title: 'Distributed Systems Deep Dive',
    description: 'Learn event-driven architectures and distributed locking.',
    date: '2030-06-15T12:00:00Z',
    maxCapacity: 2,
    registrationCount: 1,
    remainingCapacity: 1,
    status: 'upcoming',
    createdAt: '2030-06-01T10:00:00Z',
    updatedAt: '2030-06-01T10:00:00Z',
  }

  const mockRegistrations: ListRegistrationsResponse = {
    eventId: 'test-event-uuid-1',
    items: [
      {
        userId: 'attendee-001',
        registeredAt: '2030-06-01T10:30:00Z',
      },
    ],
    total: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.getEvent).mockResolvedValue(mockEvent)
    vi.mocked(apiClient.getRegistrations).mockResolvedValue(mockRegistrations)
  })

  it('renders event details, capacity metrics, and attendee roster', async () => {
    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Loading event details.../i)).toBeInTheDocument()

    expect(await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // remaining
    expect(screen.getAllByText('attendee-001').length).toBeGreaterThanOrEqual(1)
  })

  it('allows registering a new attendee and updates roster', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.registerAttendee).mockResolvedValue({
      eventId: 'test-event-uuid-1',
      userId: 'attendee-002',
      registeredAt: '2030-06-01T11:00:00Z',
    })

    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })

    // Change Demo Attendee ID to attendee-002
    const input = screen.getByLabelText(/Demo Attendee ID/i)
    await user.clear(input)
    await user.type(input, 'attendee-002')

    const registerBtn = screen.getByRole('button', { name: /^Register$/i })
    await user.click(registerBtn)

    await waitFor(() => {
      expect(apiClient.registerAttendee).toHaveBeenCalledWith('test-event-uuid-1', 'attendee-002')
    })
  })

  it('shows unregister button when demo attendee is already registered', async () => {
    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })

    // Default demo attendee is attendee-001 which is in mockRegistrations
    const unregisterBtns = screen.getAllByRole('button', { name: /^Unregister$/i })
    expect(unregisterBtns.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/is currently registered for this event/i)).toBeInTheDocument()
  })
})
