import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { Event } from '../api/types'
import { EventFormPage } from './EventFormPage'

vi.mock('../api/client', () => ({
  apiClient: {
    getEvent: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
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

describe('EventFormPage Component', () => {
  const mockEvent: Event = {
    id: 'event-probe-1',
    title: 'Edit Probe Title',
    description: 'Existing description.',
    date: '2030-06-15T13:00:45.123Z',
    maxCapacity: 50,
    registrationCount: 5,
    remainingCapacity: 45,
    status: 'upcoming',
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.getEvent).mockResolvedValue(mockEvent)
  })

  it('F09: resets form completely when navigating from edit to create', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/events/event-probe-1/edit']}>
        <Link to="/events/new">Global New Event</Link>
        <Routes>
          <Route path="/events/:id/edit" element={<EventFormPage />} />
          <Route path="/events/new" element={<EventFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Initially loads in edit mode with existing title
    expect(await screen.findByRole('heading', { name: 'Edit Event' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Event Title/i)).toHaveValue('Edit Probe Title')
    expect(screen.getByLabelText(/Description/i)).toHaveValue('Existing description.')

    // Navigate to Create New Event via link
    await user.click(screen.getByText('Global New Event'))

    // Heading changes to Create New Event
    expect(await screen.findByRole('heading', { name: 'Create New Event' })).toBeInTheDocument()

    // Form inputs must be completely reset, not leaked from the edited event
    expect(screen.getByLabelText(/Event Title/i)).toHaveValue('')
    expect(screen.getByLabelText(/Description/i)).toHaveValue('')
  })

  it('loads and populates event data in edit mode', async () => {
    render(
      <MemoryRouter initialEntries={['/events/event-probe-1/edit']}>
        <Routes>
          <Route path="/events/:id/edit" element={<EventFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Edit Event' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Event Title/i)).toHaveValue('Edit Probe Title')
    expect(screen.getByLabelText(/Maximum Capacity/i)).toHaveValue(50)
  })
})
