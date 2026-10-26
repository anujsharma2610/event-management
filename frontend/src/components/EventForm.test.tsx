import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'

describe('EventForm Component', () => {
  it('renders form fields with default values', () => {
    render(<EventForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Event Date & Time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Maximum Capacity/i)).toHaveValue(30)
    expect(screen.getByRole('button', { name: /Create Event/i })).toBeInTheDocument()
  })

  it('validates empty title and required fields before submit', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn()

    render(<EventForm onSubmit={handleSubmit} onCancel={vi.fn()} />)

    // Submit with empty title
    await user.click(screen.getByRole('button', { name: /Create Event/i }))

    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(handleSubmit).not.toHaveBeenCalled()
  })

  it('submits valid form data with trimmed title and UTC converted date', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn().mockResolvedValue(undefined)

    render(<EventForm onSubmit={handleSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText(/Title/i), '  Architecture Forum  ')
    await user.type(screen.getByLabelText(/Description/i), 'Annual discussions')
    // Set local datetime input (2030-06-15T18:30)
    await user.type(screen.getByLabelText(/Event Date & Time/i), '2030-06-15T18:30')
    await user.clear(screen.getByLabelText(/Maximum Capacity/i))
    await user.type(screen.getByLabelText(/Maximum Capacity/i), '50')

    await user.click(screen.getByRole('button', { name: /Create Event/i }))

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })

    const submittedData = handleSubmit.mock.calls[0][0]
    expect(submittedData.title).toBe('Architecture Forum')
    expect(submittedData.description).toBe('Annual discussions')
    expect(submittedData.maxCapacity).toBe(50)
    expect(typeof submittedData.date).toBe('string')
    expect(submittedData.date.endsWith('Z')).toBe(true)
  })

  it('disables submit button while submitting to prevent duplicate submission', async () => {
    const user = userEvent.setup()
    let resolveSubmit: () => void = () => {}
    const slowSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        }),
    )

    render(<EventForm onSubmit={slowSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText(/Title/i), 'Fast Double Click')
    await user.type(screen.getByLabelText(/Event Date & Time/i), '2030-06-15T18:30')

    const submitBtn = screen.getByRole('button', { name: /Create Event/i })
    await user.click(submitBtn)

    expect(submitBtn).toBeDisabled()
    expect(submitBtn).toHaveTextContent(/Creating Event.../i)

    resolveSubmit()
    await waitFor(() => expect(submitBtn).not.toBeDisabled())
  })

  it('F07: preserves exact seconds and fractional precision when date is untouched', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn().mockResolvedValue(undefined)
    const exactDateWithFractions = '2030-06-15T13:00:45.123Z'

    render(
      <EventForm
        initialValues={{
          title: 'Original Title',
          description: 'Original Description',
          date: exactDateWithFractions,
          maxCapacity: 25,
        }}
        isEditing={true}
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
      />,
    )

    // Edit only the title, leaving date field untouched
    const titleInput = screen.getByLabelText(/Title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Title Only')

    await user.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1))

    const submitted = handleSubmit.mock.calls[0][0]
    expect(submitted.title).toBe('Updated Title Only')
    // Must preserve the exact raw original timestamp with .123Z fractions intact
    expect(submitted.date).toBe(exactDateWithFractions)
  })

  it('F07: updates timestamp when date is explicitly modified by user', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <EventForm
        initialValues={{
          title: 'Original Title',
          description: '',
          date: '2030-06-15T13:00:45.123Z',
          maxCapacity: 25,
        }}
        isEditing={true}
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
      />,
    )

    // Explicitly modify the date input
    const dateInput = screen.getByLabelText(/Event Date & Time/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2030-07-20T15:00')

    await user.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1))

    const submitted = handleSubmit.mock.calls[0][0]
    expect(submitted.date).not.toBe('2030-06-15T13:00:45.123Z')
    expect(typeof submitted.date).toBe('string')
    expect(submitted.date.endsWith('Z')).toBe(true)
  })
})
