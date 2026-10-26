import React, { useState } from 'react'
import { ApiError } from '../api/client'
import { Event, RegistrationItem } from '../api/types'

interface AttendeeControlsProps {
  event: Event
  registrations: RegistrationItem[]
  onRegister: (userId: string) => Promise<void>
  onUnregister: (userId: string) => Promise<void>
}

export const AttendeeControls: React.FC<AttendeeControlsProps> = ({
  event,
  registrations,
  onRegister,
  onUnregister,
}) => {
  const [demoUserId, setDemoUserId] = useState('attendee-001')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const trimmedId = demoUserId.trim()
  const isRegistered = registrations.some((r) => r.userId === trimmedId)
  const isPast = event.status === 'past'
  const isFull = event.status === 'full'

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
    <div className="attendee-controls-card">
      <div className="attendee-controls-header">
        <h3>Attendee Registration</h3>
        <p className="demo-identity-hint">
          <strong>Demo identity:</strong> Switch this ID to simulate different users registering or
          unregistering.
        </p>
      </div>

      {errorMessage && (
        <div className="alert alert-error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="attendee-action-box">
        <div className="form-group">
          <label htmlFor="demo-user-id">
            Demo Attendee ID
          </label>
          <div className="attendee-input-row">
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

        <div className="registration-status-guidance">
          {isRegistered && (
            <span className="status-indicator status-indicator-success">
              ✓ Attendee <code>{trimmedId}</code> is currently registered for this event.
            </span>
          )}

          {!isRegistered && isPast && (
            <span className="status-indicator status-indicator-disabled">
              Registration is closed because this event has started or passed.
            </span>
          )}

          {!isRegistered && !isPast && isFull && (
            <span className="status-indicator status-indicator-disabled">
              Registration is closed because this event is at maximum capacity ({event.maxCapacity} seats).
            </span>
          )}

          {!isRegistered && !isPast && !isFull && (
            <span className="status-indicator status-indicator-open">
              Registration is open. {event.remainingCapacity} seat
              {event.remainingCapacity === 1 ? '' : 's'} remaining.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
