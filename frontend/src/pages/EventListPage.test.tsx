import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { Event } from '../api/types'
import { EventListPage } from './EventListPage'

vi.mock('../api/client', () => ({
  apiClient: {
    getEvents: vi.fn(),
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

describe('EventListPage Component', () => {
  const mockEvents: Event[] = [
    {
      id: 'e-1',
      title: 'Cloud Architecture Summit',
      description: 'Deep dive into microservices.',
      date: '2030-06-15T12:00:00Z',
      maxCapacity: 100,
      registrationCount: 10,
      remainingCapacity: 90,
      status: 'upcoming',
      createdAt: '2030-01-01T00:00:00Z',
      updatedAt: '2030-01-01T00:00:00Z',
    },
    {
      id: 'e-2',
      title: 'Workshop: High-Throughput APIs',
      description: 'Hands-on performance lab.',
      date: '2030-07-01T10:00:00Z',
      maxCapacity: 2,
      registrationCount: 2,
      remainingCapacity: 0,
      status: 'full',
      createdAt: '2030-01-01T00:00:00Z',
      updatedAt: '2030-01-01T00:00:00Z',
    },
    {
      id: 'e-3',
      title: 'Retrospective 2029',
      description: 'Reviewing past milestones.',
      date: '2025-01-01T10:00:00Z',
      maxCapacity: 50,
      registrationCount: 15,
      remainingCapacity: 35,
      status: 'past',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.getEvents).mockResolvedValue({
      items: mockEvents,
      total: 3,
    })
  })

  it('renders event list with category counts and search controls', async () => {
    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^Events$/i })).toBeInTheDocument()

    // Assert event titles are rendered
    expect(screen.getByText('Cloud Architecture Summit')).toBeInTheDocument()
    expect(screen.getByText('Workshop: High-Throughput APIs')).toBeInTheDocument()
    expect(screen.getByText('Retrospective 2029')).toBeInTheDocument()

    // Assert status badges
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getAllByText('Past').length).toBeGreaterThanOrEqual(1)
  })

  it('filters events by search query including leading and trailing whitespace', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    )

    await screen.findByText('Cloud Architecture Summit')

    const searchInput = screen.getByLabelText(/Search events/i)
    // Query with untrimmed whitespace
    await user.type(searchInput, '   architecture   ')

    expect(screen.getByText('Cloud Architecture Summit')).toBeInTheDocument()
    expect(screen.queryByText('Workshop: High-Throughput APIs')).not.toBeInTheDocument()
    expect(screen.queryByText('Retrospective 2029')).not.toBeInTheDocument()
  })

  it('filters events by category filter button', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    )

    await screen.findByText('Cloud Architecture Summit')

    // Click "Past" category filter
    const pastBtn = screen.getByRole('button', { name: /^Past/i })
    await user.click(pastBtn)

    expect(pastBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Retrospective 2029')).toBeInTheDocument()
    expect(screen.queryByText('Cloud Architecture Summit')).not.toBeInTheDocument()
    expect(screen.queryByText('Workshop: High-Throughput APIs')).not.toBeInTheDocument()
  })

  it('renders empty state when no events returned', async () => {
    vi.mocked(apiClient.getEvents).mockResolvedValue({
      items: [],
      total: 0,
    })

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/No events found/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Create Event/i }).length).toBeGreaterThanOrEqual(1)
  })
})
