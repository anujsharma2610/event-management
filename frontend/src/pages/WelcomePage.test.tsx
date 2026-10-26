import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { WelcomePage } from './WelcomePage'

describe('WelcomePage Component', () => {
  it('renders welcome heading and primary action buttons', () => {
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'Event Management Workspace' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View events' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Create event' })).toHaveAttribute(
      'href',
      '/events/new',
    )
  })

  it('renders architecture feature highlights and demo seed guidance', () => {
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Event Lifecycle')).toBeInTheDocument()
    expect(screen.getByText('Atomic Seat Capacity')).toBeInTheDocument()
    expect(screen.getByText('Timezone Awareness')).toBeInTheDocument()
    expect(screen.getByText('Light & Dark Appearance')).toBeInTheDocument()
    expect(screen.getByText(/SEED_DEMO_DATA=true/)).toBeInTheDocument()
  })
})
