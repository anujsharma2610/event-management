import React, { useState } from 'react'
import { ApiError } from '../api/client'
import { Event, RegistrationItem } from '../api/types'

interface AttendeeControlsProps {
  event: Event
  registrations: RegistrationItem[]
  selectedUserId?: string
  onSelectedUserIdChange?: (userId: string) => void
  onRegister: (userId: string) => Promise<void>
  onUnregister: (userId: string) => Promise<void>
}

export const AttendeeControls: React.FC<AttendeeControlsProps> = ({
  event,
  registrations,
  selectedUserId,
  onSelectedUserIdChange,
  onRegister,
  onUnregister,
}) => {
  const [localUserId, setLocalUserId] = useState('attendee-001')
  const demoUserId = selectedUserId !== undefined ? selectedUserId : localUserId
  const setDemoUserId = (val: string) => {
    if (onSelectedUserIdChange) {
      onSelectedUserIdChange(val)
    } else {
      setLocalUserId(val)
    }
  }

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const trimmedId = demoUserId.trim()
  const isRegistered = registrations.some((r) => r.userId === trimmedId)
  const isPast = event.status === 'past'
  const isFull = event.status === 'full'

  const occupancyPct = Math.min(
    100,
    Math.round((event.registrationCount / event.maxCapacity) * 100),
  )

  const validateUserId = (id: string): boolean => {
    if (!id) {
      setValidationError('Attendee ID is required.')
      return false
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      setValidationError(
        'Attendee ID must be 1-64 alphanumeric characters, underscores, or hyphens [A-Za-z0-9_-].',
      )
      return false
    }
    setValidationError(null)
    return true
  }

  const handleRegister = async () => {
    if (!validateUserId(trimmedId)) return
    setIsLoading(true)
    setErrorMessage(null)

    try {
      await onRegister(trimmedId)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to register attendee. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnregister = async (targetUserId?: string) => {
    const idToUnregister = targetUserId || trimmedId
    if (!validateUserId(idToUnregister)) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      await onUnregister(idToUnregister)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to unregister attendee. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="attendee-registration-card">
      <div className="card-top-header">
        <h3 className="card-title">Registration & RSVP</h3>
        <span
          className={`badge ${
            isPast ? 'badge-past' : isFull ? 'badge-full' : 'badge-upcoming'
          }`}
        >
          {isPast ? 'CLOSED' : isFull ? 'SOLD OUT' : 'OPEN'}
        </span>
      </div>

      {/* Capacity Gauge (Luma / Eventbrite Pattern) */}
      <div className="capacity-gauge-box">
        <div className="gauge-labels">
          <span className="gauge-primary">
            <strong>{event.remainingCapacity}</strong> seats remaining
          </span>
          <span className="gauge-total">
            {event.registrationCount} / {event.maxCapacity} booked ({occupancyPct}%)
          </span>
        </div>
        <div className="capacity-track">
          <div
            className={`capacity-fill ${
              isFull ? 'fill-full' : isPast ? 'fill-past' : 'fill-upcoming'
            }`}
            style={{ width: `${occupancyPct}%` }}
          ></div>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Demo Identity Switcher Box */}
      <div className="demo-identity-box">
        <div className="form-group">
          <label htmlFor="demo-user-id" className="demo-label">
            <span>Attendee Identity</span>
            <span className="demo-badge">Interactive Demo</span>
          </label>
          <p className="demo-subtext">
            Change this ID to test registering and unregistering as multiple attendees.
          </p>

          <div className="identity-input-group">
            <input
              id="demo-user-id"
              type="text"
              value={demoUserId}
              maxLength={64}
              onChange={(e) => {
                setDemoUserId(e.target.value)
                setErrorMessage(null)
                if (validationError) validateUserId(e.target.value.trim())
              }}
              placeholder="e.g. attendee-001"
              disabled={isLoading}
              aria-invalid={!!validationError}
              aria-describedby={validationError ? 'user-id-error' : undefined}
            />

            {isRegistered ? (
              <button
                type="button"
                onClick={() => handleUnregister()}
                className="btn btn-warning"
                disabled={isLoading}
              >
                {isLoading ? 'Unregistering...' : 'Unregister'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRegister}
                className="btn btn-primary"
                disabled={isLoading || isPast || (isFull && !isRegistered)}
              >
                {isLoading ? 'Registering...' : 'Register'}
              </button>
            )}
          </div>

          {validationError && (
            <p id="user-id-error" className="field-error" role="alert">
              {validationError}
            </p>
          )}
        </div>
      </div>

      {/* Contextual Status Guidance */}
      <div className="status-guidance-card">
        {isRegistered && (
          <div className="guidance-banner guidance-registered">
            <span className="guidance-icon" aria-hidden="true">✓</span>
            <div>
              <strong>You are registered</strong>
              <p>Attendee <code>{trimmedId}</code> is confirmed on the guest list.</p>
            </div>
          </div>
        )}

        {!isRegistered && isPast && (
          <div className="guidance-banner guidance-closed">
            <span className="guidance-icon" aria-hidden="true">🔒</span>
            <div>
              <strong>Registration Closed</strong>
              <p>This event has already started or passed. No new registrations are accepted.</p>
            </div>
          </div>
        )}

        {!isRegistered && !isPast && isFull && (
          <div className="guidance-banner guidance-full">
            <span className="guidance-icon" aria-hidden="true">⚠️</span>
            <div>
              <strong>Event is at Capacity</strong>
              <p>All {event.maxCapacity} seats have been reserved. Registration is closed.</p>
            </div>
          </div>
        )}

        {!isRegistered && !isPast && !isFull && (
          <div className="guidance-banner guidance-open">
            <span className="guidance-icon" aria-hidden="true">🎟️</span>
            <div>
              <strong>Instant Confirmation</strong>
              <p>Seats are available. Reserve your spot for this event above.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
