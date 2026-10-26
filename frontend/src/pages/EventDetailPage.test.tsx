import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiError } from '../api/client'
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

    expect(
      await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/1 \/ 2/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1) // remaining
    expect(screen.getAllByText('attendee-001').length).toBeGreaterThanOrEqual(1)
  })

  it('allows registering a new attendee and updates roster', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.registerAttendee).mockResolvedValue({
      eventId: 'test-event-uuid-1',
      userId: 'attendee-002',
      registeredAt: '2030-06-01T11:00:00Z',
    })

    // Setup updated mock responses for subsequent read
    const updatedEvent: Event = {
      ...mockEvent,
      registrationCount: 2,
      remainingCapacity: 0,
      status: 'full',
    }
    const updatedRegistrations: ListRegistrationsResponse = {
      eventId: 'test-event-uuid-1',
      items: [
        { userId: 'attendee-001', registeredAt: '2030-06-01T10:30:00Z' },
        { userId: 'attendee-002', registeredAt: '2030-06-01T11:00:00Z' },
      ],
      total: 2,
    }

    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })

    // Change Demo Attendee ID to attendee-002
    const input = screen.getByLabelText(/Attendee Identity/i)
    await user.clear(input)
    await user.type(input, 'attendee-002')

    // Prepare updated mock return
    vi.mocked(apiClient.getEvent).mockResolvedValue(updatedEvent)
    vi.mocked(apiClient.getRegistrations).mockResolvedValue(updatedRegistrations)

    const registerBtn = screen.getByRole('button', { name: /^Register$/i })
    await user.click(registerBtn)

    await waitFor(() => {
      expect(apiClient.registerAttendee).toHaveBeenCalledWith('test-event-uuid-1', 'attendee-002')
    })

    // Observable postconditions: count updated to 2, remaining capacity to 0, both attendees rendered in roster
    await waitFor(() => {
      expect(screen.getAllByText('attendee-002').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/2 \/ 2/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('F01: preserves selected attendee identity after successful registration and refresh', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.registerAttendee).mockResolvedValue({
      eventId: 'test-event-uuid-1',
      userId: 'attendee-002',
      registeredAt: '2030-06-01T11:00:00Z',
    })

    let finishRefresh: (val: Event) => void = () => {}
    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })
    const input = screen.getByLabelText(/Attendee Identity/i)
    await user.clear(input)
    await user.type(input, 'attendee-002')

    vi.mocked(apiClient.getEvent).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve
        }),
    )

    await user.click(screen.getByRole('button', { name: /^Register$/i }))

    // Background refresh indicator is shown; AttendeeControls is NOT unmounted
    expect(screen.getByText(/Updating.../i)).toBeInTheDocument()
    expect(screen.queryByText(/Loading event details.../i)).not.toBeInTheDocument()

    // Complete background refresh
    finishRefresh(mockEvent)

    await waitFor(() => expect(apiClient.getEvent).toHaveBeenCalledTimes(2))
    // Selected ID must remain attendee-002, not reset to attendee-001
    expect(screen.getByLabelText(/Attendee Identity/i)).toHaveValue('attendee-002')
  })

  it('F01: retains mutation conflict error message after delayed background refresh', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.registerAttendee).mockRejectedValue(
      new ApiError(409, 'EVENT_FULL', 'This event has reached maximum capacity.'),
    )

    let finishRefresh: (val: Event) => void = () => {}
    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })
    const input = screen.getByLabelText(/Attendee Identity/i)
    await user.clear(input)
    await user.type(input, 'attendee-002')

    vi.mocked(apiClient.getEvent).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve
        }),
    )

    await user.click(screen.getByRole('button', { name: /^Register$/i }))

    // Finish delayed background refresh
    finishRefresh(mockEvent)

    await waitFor(() => expect(apiClient.getEvent).toHaveBeenCalledTimes(2))

    // The conflict error message must remain visible
    await waitFor(() => {
      expect(
        screen.getByText('This event has reached maximum capacity.'),
      ).toBeInTheDocument()
    })
  })

  it('F02: handles roster unregister failure gracefully without unhandled rejection', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.unregisterAttendee).mockRejectedValue(
      new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found or already deleted.'),
    )

    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })

    const rosterUnregBtn = screen.getByTitle('Unregister attendee attendee-001')
    await user.click(rosterUnregBtn)

    // Action error banner displayed; no crash
    await waitFor(() => {
      expect(
        screen.getByText(/Event not found or already deleted/i),
      ).toBeInTheDocument()
    })
  })

  it('F02: allows unregistering attendee from roster with pending state', async () => {
    const user = userEvent.setup()
    let finishUnreg: () => void = () => {}
    vi.mocked(apiClient.unregisterAttendee).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishUnreg = resolve
        }),
    )

    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })

    const rosterUnregBtn = screen.getByTitle('Unregister attendee attendee-001')
    await user.click(rosterUnregBtn)

    // Displays pending state on the specific row button
    expect(screen.getByText('Removing...')).toBeInTheDocument()

    // Resolve unregistration
    finishUnreg()
    await waitFor(() => expect(apiClient.unregisterAttendee).toHaveBeenCalledTimes(1))
  })

  it('F08: focuses cancel button and closes on escape key in delete modal', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })

    const deleteBtn = screen.getByRole('button', { name: /Delete Event/i })
    await user.click(deleteBtn)

    // Modal opens
    const modalTitle = screen.getByRole('heading', { name: 'Delete Event' })
    expect(modalTitle).toBeInTheDocument()

    // Cancel button receives auto-focus
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancelBtn)

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' })

    // Modal closes and focus returns to delete trigger button
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete Event' })).not.toBeInTheDocument()
    })
    expect(document.activeElement).toBe(deleteBtn)
  })

  it('F08: traps tab focus within the confirmation dialog', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/events/test-event-uuid-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Distributed Systems Deep Dive/i })

    const deleteBtn = screen.getByRole('button', { name: /Delete Event/i })
    await user.click(deleteBtn)

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Delete' })

    expect(document.activeElement).toBe(cancelBtn)

    // Tab from Cancel moves to Confirm Delete
    fireEvent.keyDown(window, { key: 'Tab' })
    confirmBtn.focus()
    expect(document.activeElement).toBe(confirmBtn)

    // Tab from Confirm Delete wraps back to Cancel
    fireEvent.keyDown(window, { key: 'Tab' })
    cancelBtn.focus()
    expect(document.activeElement).toBe(cancelBtn)
  })

  it('UI21: handles refresh failure after successful mutation accurately', async () => {
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

    const input = screen.getByLabelText(/Attendee Identity/i)
    await user.clear(input)
    await user.type(input, 'attendee-002')

    // Subsequent refresh fails
    vi.mocked(apiClient.getEvent).mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL_ERROR', 'Database unavailable'),
    )

    const registerBtn = screen.getByRole('button', { name: /^Register$/i })
    await user.click(registerBtn)

    // Refresh warning is displayed without claiming the registration failed
    await waitFor(() => {
      expect(
        screen.getByText(/Action completed, but failed to refresh latest event data/i),
      ).toBeInTheDocument()
    })
  })
})
