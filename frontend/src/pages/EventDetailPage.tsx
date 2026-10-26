import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiClient, ApiError } from '../api/client'
import { Event, RegistrationItem } from '../api/types'
import { AttendeeControls } from '../components/AttendeeControls'
import { formatDisplayDate } from '../utils/date'

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return
      setIsLoading(true)
      setError(null)

      try {
        const [eventData, regData] = await Promise.all([
          apiClient.getEvent(id, signal),
          apiClient.getRegistrations(id, signal),
        ])
        setEvent(eventData)
        setRegistrations(regData.items)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Failed to load event details.')
        }
      } finally {
        setIsLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const handleRegister = async (userId: string) => {
    if (!id) return
    try {
      await apiClient.registerAttendee(id, userId)
    } finally {
      await loadData()
    }
  }

  const handleUnregister = async (userId: string) => {
    if (!id) return
    try {
      await apiClient.unregisterAttendee(id, userId)
    } finally {
      await loadData()
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setIsDeleting(true)
    try {
      await apiClient.deleteEvent(id)
      navigate('/')
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to delete event.')
      }
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="state-card loading-state" role="status">
          <div className="spinner" aria-hidden="true"></div>
          <p>Loading event details...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="page-container">
        <div className="state-card error-state" role="alert">
          <h3>Error Loading Event</h3>
          <p className="error-message">{error || 'Event not found.'}</p>
          <div className="form-actions">
            <Link to="/" className="btn btn-secondary">
              Back to Events
            </Link>
            <button onClick={() => loadData()} className="btn btn-primary">
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const getStatusBadgeClass = (status: Event['status']) => {
    switch (status) {
      case 'upcoming':
        return 'badge badge-upcoming'
      case 'full':
        return 'badge badge-full'
      case 'past':
        return 'badge badge-past'
    }
  }

  return (
    <div className="page-container">
      <div className="detail-navigation">
        <Link to="/" className="btn-back">
          ← Back to Events
        </Link>
        <button
          onClick={() => loadData()}
          className="btn btn-sm btn-ghost"
          title="Refresh event data from server"
        >
          🔄 Refresh
        </button>
      </div>

      <header className="event-detail-header">
        <div className="event-detail-title-row">
          <div>
            <div className="badge-row">
              <span className={getStatusBadgeClass(event.status)}>
                {event.status.toUpperCase()}
              </span>
            </div>
            <h2>{event.title}</h2>
          </div>

          <div className="detail-actions">
            <Link to={`/events/${event.id}/edit`} className="btn btn-secondary">
              Edit Event
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn btn-danger"
              disabled={isDeleting}
            >
              Delete Event
            </button>
          </div>
        </div>

        <div className="event-metrics-grid">
          <div className="metric-card">
            <span className="metric-label">Date & Time</span>
            <span className="metric-value">📅 {formatDisplayDate(event.date)}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Registrations</span>
            <span className="metric-value">
              {event.registrationCount} / {event.maxCapacity}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Remaining Seats</span>
            <span className="metric-value">{event.remainingCapacity}</span>
          </div>
        </div>
      </header>

      {event.description && (
        <section className="event-description-section">
          <h3>About this Event</h3>
          <p className="event-full-description">{event.description}</p>
        </section>
      )}

      {/* Registration Section */}
      <section className="registration-management-section">
        <AttendeeControls
          event={event}
          registrations={registrations}
          onRegister={handleRegister}
          onUnregister={handleUnregister}
        />
      </section>

      {/* Registered Attendees Roster */}
      <section className="attendees-roster-section">
        <div className="roster-header">
          <h3>Registered Attendees ({registrations.length})</h3>
        </div>

        {registrations.length === 0 ? (
          <div className="empty-roster">
            <p>No attendees have registered for this event yet.</p>
          </div>
        ) : (
          <div className="attendee-table-container">
            <table className="attendee-table">
              <thead>
                <tr>
                  <th scope="col">User ID</th>
                  <th scope="col">Registered At</th>
                  <th scope="col" className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((attendee) => (
                  <tr key={attendee.userId}>
                    <td className="attendee-id-cell">
                      <code>{attendee.userId}</code>
                    </td>
                    <td className="attendee-date-cell">
                      {formatDisplayDate(attendee.registeredAt)}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleUnregister(attendee.userId)}
                        className="btn btn-sm btn-ghost-danger"
                        title={`Unregister ${attendee.userId}`}
                      >
                        Unregister
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal / Dialog */}
      {showDeleteConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-card">
            <h3 id="modal-title">Delete Event</h3>
            <p>
              Are you sure you want to permanently delete <strong>{event.title}</strong>?
            </p>
            <p className="modal-warning">
              This action cannot be undone. All <strong>{registrations.length}</strong> attendee
              registration{registrations.length === 1 ? '' : 's'} will also be permanently removed.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-danger"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
