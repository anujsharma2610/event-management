import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './api/client'
import { App } from './App'
import { THEME_STORAGE_KEY } from './utils/theme'

// Mock apiClient to avoid real network requests during App testing
vi.mock('./api/client', () => {
  return {
    apiClient: {
      getEvents: vi.fn().mockResolvedValue({
        total: 1,
        items: [
          {
            id: 'evt-1',
            title: 'Tech Conference 2026',
            description: 'Annual gathering',
            date: '2026-11-20T10:00:00Z',
            maxCapacity: 100,
            registrationCount: 0,
            remainingCapacity: 100,
            status: 'upcoming',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
      getEvent: vi.fn().mockResolvedValue({
        id: 'evt-1',
        title: 'Tech Conference 2026',
        description: 'Annual gathering',
        date: '2026-11-20T10:00:00Z',
        maxCapacity: 100,
        registrationCount: 0,
        remainingCapacity: 100,
        status: 'upcoming',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
      getRegistrations: vi.fn().mockResolvedValue({ eventId: 'evt-1', total: 0, items: [] }),
      createEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
      registerAttendee: vi.fn(),
      unregisterAttendee: vi.fn(),
    },
    ApiError: class MockApiError extends Error {
      status: number
      body: unknown
      constructor(status: number, body: unknown) {
        const detail =
          typeof body === 'object' && body !== null && 'detail' in body
            ? String((body as { detail: unknown }).detail)
            : 'API error'
        super(detail)
        this.status = status
        this.body = body
      }
    },
  }
})

describe('App Appearance & Dark Mode Integration', () => {
  let mediaListeners: Array<() => void> = []
  let matchesDark = false

  beforeEach(() => {
    window.history.pushState({}, '', '/')
    localStorage.clear()
    mediaListeners = []
    matchesDark = false
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''

    vi.mocked(apiClient.getEvents).mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'evt-1',
          title: 'Tech Conference 2026',
          description: 'Annual gathering',
          date: '2026-11-20T10:00:00Z',
          maxCapacity: 100,
          registrationCount: 0,
          remainingCapacity: 100,
          status: 'upcoming',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    })

    vi.mocked(apiClient.getEvent).mockResolvedValue({
      id: 'evt-1',
      title: 'Tech Conference 2026',
      description: 'Annual gathering',
      date: '2026-11-20T10:00:00Z',
      maxCapacity: 100,
      registrationCount: 0,
      remainingCapacity: 100,
      status: 'upcoming',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })

    vi.mocked(apiClient.getRegistrations).mockResolvedValue({
      eventId: 'evt-1',
      items: [],
      total: 0,
    })

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' ? matchesDark : false
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === 'change') {
          mediaListeners.push(callback)
        }
      }),
      removeEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === 'change') {
          mediaListeners = mediaListeners.filter((cb) => cb !== callback)
        }
      }),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Scenario 1: First visit with light system setting resolves to Light and shows System in selector', async () => {
    matchesDark = false
    render(<App />)

    const select = (await screen.findByLabelText('Theme appearance')) as HTMLSelectElement
    expect(select.value).toBe('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('Scenario 2: First visit with dark system setting resolves to Dark and shows System in selector', async () => {
    matchesDark = true
    render(<App />)

    const select = (await screen.findByLabelText('Theme appearance')) as HTMLSelectElement
    expect(select.value).toBe('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('Scenario 3: Explicit Light while system is dark persists light', async () => {
    matchesDark = true
    render(<App />)

    const select = await screen.findByLabelText('Theme appearance')
    await userEvent.selectOptions(select, 'light')

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('Scenario 4: Explicit Dark while system is light persists dark', async () => {
    matchesDark = false
    render(<App />)

    const select = await screen.findByLabelText('Theme appearance')
    await userEvent.selectOptions(select, 'dark')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('Scenario 5: System changes while preference is System updates resolved appearance', async () => {
    matchesDark = false
    render(<App />)
    await screen.findByLabelText('Theme appearance')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // Simulate OS switching to dark mode
    matchesDark = true
    act(() => {
      mediaListeners.forEach((listener) => listener())
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('Scenario 6: System changes while preference is explicit does not alter appearance', async () => {
    matchesDark = false
    render(<App />)

    const select = await screen.findByLabelText('Theme appearance')
    await userEvent.selectOptions(select, 'light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // Simulate OS switching to dark mode
    matchesDark = true
    act(() => {
      mediaListeners.forEach((listener) => listener())
    })

    // Still light because user explicitly chose light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('Scenario 7: Safe system fallback on invalid saved value', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'bogus_value')
    matchesDark = true
    render(<App />)

    const select = (await screen.findByLabelText('Theme appearance')) as HTMLSelectElement
    expect(select.value).toBe('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('Scenario 8: App usable when localStorage throws on write', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    render(<App />)
    const select = (await screen.findByLabelText('Theme appearance')) as HTMLSelectElement
    await userEvent.selectOptions(select, 'dark')

    // Session appearance changes even if storage write fails
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(select.value).toBe('dark')
  })

  it('Scenario 12: Accessible appearance control has label, exposed value, and keyboard focus', async () => {
    render(<App />)
    const select = screen.getByRole('combobox', { name: 'Theme appearance' })
    expect(select).toBeInTheDocument()

    // Test focus retention and keyboard interaction
    select.focus()
    expect(document.activeElement).toBe(select)

    await userEvent.keyboard('{ArrowDown}')
    expect(select).toHaveFocus()
  })

  it('Scenario 14: Cleans up listeners on unmount without duplicate listeners', () => {
    const { unmount } = render(<App />)
    expect(mediaListeners.length).toBe(1)

    unmount()
    expect(mediaListeners.length).toBe(0)
  })

  it('Scenario 15: Cross-tab synchronization reconciles storage events', async () => {
    matchesDark = false
    render(<App />)
    const select = (await screen.findByLabelText('Theme appearance')) as HTMLSelectElement
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // Simulate another browser tab saving 'dark'
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: THEME_STORAGE_KEY,
          newValue: 'dark',
        })
      )
    })

    expect(select.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('Scenario 9: Switching appearance preserves form input and focus', async () => {
    render(<App />)

    // Navigate to create form
    const newEventBtn = screen.getByRole('link', { name: '+ New Event' })
    await userEvent.click(newEventBtn)

    // Type into form
    const titleInput = await screen.findByLabelText(/Event Title/i)
    await userEvent.type(titleInput, 'Preserved Title Value')
    expect(titleInput).toHaveValue('Preserved Title Value')

    // Toggle theme while form is dirty
    const select = screen.getByLabelText('Theme appearance')
    await userEvent.selectOptions(select, 'dark')

    // Theme applied, form input remains completely untouched
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(titleInput).toHaveValue('Preserved Title Value')
  })

  it('Scenario 10: Switching appearance preserves selected attendee identity and pending modal state', async () => {
    render(<App />)

    // Wait for event list to load and click on event to go to detail
    const eventLink = await screen.findByText('Tech Conference 2026')
    await userEvent.click(eventLink)

    // Verify detail page is rendered with default attendee ID
    const attendeeInput = await screen.findByLabelText(/Attendee Identity/i)
    await userEvent.clear(attendeeInput)
    await userEvent.type(attendeeInput, 'attendee-custom-77')
    expect(attendeeInput).toHaveValue('attendee-custom-77')

    // Open delete event confirmation modal
    const deleteBtn = screen.getByRole('button', { name: /Delete Event/i })
    await userEvent.click(deleteBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Switch appearance via shell select
    const themeSelect = screen.getByLabelText('Theme appearance')
    await userEvent.selectOptions(themeSelect, 'dark')

    // Theme changed, dialog still open and attendee input preserved
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Attendee Identity/i)).toHaveValue('attendee-custom-77')
  })
})
