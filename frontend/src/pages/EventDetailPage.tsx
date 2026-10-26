import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiClient, ApiError } from '../api/client'
import { Event, RegistrationItem } from '../api/types'
import { AttendeeControls } from '../components/AttendeeControls'
import { getAvatarColor, getInitials } from '../utils/avatar'
import { formatDisplayDate, getDateTileParts } from '../utils/date'

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [rosterActionError, setRosterActionError] = useState<string | null>(null)
  const [unregisteringUserId, setUnregisteringUserId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('attendee-001')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')

  const eventRef = useRef<Event | null>(null)
  eventRef.current = event

  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(
    async (signal?: AbortSignal, isBackground = false) => {
      if (!id) return
      const isInitial = eventRef.current === null && !isBackground
      if (isInitial) {
        setIsLoading(true)
        setError(null)
      } else {
        setIsRefreshing(true)
      }

      try {
        const [eventData, regData] = await Promise.all([
          apiClient.getEvent(id, signal),
          apiClient.getRegistrations(id, signal),
        ])
        setEvent(eventData)
        setRegistrations(regData.items)
        setRefreshError(null)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (isInitial) {
          if (err instanceof ApiError) {
            setError(err.message)
          } else {
            setError('Failed to load event details.')
          }
        } else {
          setRefreshError('Action completed, but failed to refresh latest event data.')
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [id],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  // F08: Accessible modal keyboard interaction (Escape listener & Tab focus trap)
  useEffect(() => {
    if (!showDeleteConfirm) return

    cancelBtnRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowDeleteConfirm(false)
        deleteTriggerRef.current?.focus()
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLButtonElement>(
          'button:not([disabled])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDeleteConfirm])

  const filteredRegistrations = useMemo(() => {
    if (!rosterSearch.trim()) return registrations
    const q = rosterSearch.trim().toLowerCase()
    return registrations.filter((r) => r.userId.toLowerCase().includes(q))
  }, [registrations, rosterSearch])

  const handleRegister = async (userId: string) => {
    if (!id) return
    try {
      await apiClient.registerAttendee(id, userId)
    } finally {
      await loadData(undefined, true)
    }
  }

  const handleUnregister = async (userId: string) => {
    if (!id) return
    try {
      await apiClient.unregisterAttendee(id, userId)
    } finally {
      await loadData(undefined, true)
    }
  }

  const handleRosterUnregister = async (targetUserId: string) => {
    if (!id || unregisteringUserId) return
    setUnregisteringUserId(targetUserId)
    setRosterActionError(null)

    try {
      await apiClient.unregisterAttendee(id, targetUserId)
      await loadData(undefined, true)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setRosterActionError(err.message)
      } else {
        setRosterActionError('Failed to unregister attendee.')
      }
    } finally {
      setUnregisteringUserId(null)
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
      deleteTriggerRef.current?.focus()
    }
  }

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false)
    deleteTriggerRef.current?.focus()
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

  const dateTile = getDateTileParts(event.date)

  return (
    <div className="page-container">
      {/* Top Navigation Bar */}
      <div className="detail-top-bar">
        <Link to="/" className="btn-back">
          ← Back to Events
        </Link>

        <div className="top-bar-right">
          {isRefreshing && (
            <span className="refreshing-indicator" aria-live="polite">
              Updating...
            </span>
          )}
          <button
            onClick={() => loadData(undefined, true)}
            className="btn btn-sm btn-ghost"
            title="Refresh event data from server"
            disabled={isRefreshing}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="alert alert-warning" role="alert" style={{ marginBottom: '1rem' }}>
          <span>⚠️ {refreshError}</span>
          <button
            onClick={() => setRefreshError(null)}
            className="btn-close"
            aria-label="Dismiss warning"
          >
            ×
          </button>
        </div>
      )}

      {/* Two-Column Responsive Layout (Luma Reference Pattern) */}
      <div className="event-detail-layout">
        {/* Left Column: Event Information & Attendee Roster */}
        <div className="detail-main-column">
          <div className="detail-header-card">
            <div className="detail-header-top">
              <div className="date-tile date-tile-lg" aria-hidden="true">
                <span className="date-tile-month">{dateTile.month}</span>
                <span className="date-tile-day">{dateTile.day}</span>
              </div>

              <div className="detail-title-group">
                <span
                  className={`badge ${
                    event.status === 'past'
                      ? 'badge-past'
                      : event.status === 'full'
                        ? 'badge-full'
                        : 'badge-upcoming'
                  }`}
                >
                  <span className="badge-dot" aria-hidden="true"></span>
                  {event.status.toUpperCase()}
                </span>
                <h1 className="event-title-h1">{event.title}</h1>
                <p className="event-datetime-sub">
                  📅 {formatDisplayDate(event.date)}
                </p>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="quick-metrics-row">
              <div className="quick-metric">
                <span className="metric-caption">Booked</span>
                <span className="metric-num">
                  {event.registrationCount} / {event.maxCapacity}
                </span>
              </div>
              <div className="metric-divider" aria-hidden="true"></div>
              <div className="quick-metric">
                <span className="metric-caption">Remaining</span>
                <span className="metric-num">{event.remainingCapacity}</span>
              </div>
              <div className="metric-divider" aria-hidden="true"></div>
              <div className="quick-metric">
                <span className="metric-caption">Status</span>
                <span className="metric-num capitalize">{event.status}</span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {event.description && (
            <section className="detail-content-card">
              <h3 className="section-title">About this event</h3>
              <p className="event-description-text">{event.description}</p>
            </section>
          )}

          {/* Attendee Roster Section */}
          <section className="detail-content-card roster-section">
            <div className="roster-header-row">
              <div>
                <h3 className="section-title">Registered Attendees</h3>
                <span className="roster-count-sub">
                  {registrations.length} participant{registrations.length === 1 ? '' : 's'} registered
                </span>
              </div>

              {registrations.length > 0 && (
                <div className="roster-search-wrap">
                  <input
                    type="search"
                    placeholder="Filter roster..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="roster-search-input"
                    aria-label="Filter attendee roster by name"
                  />
                </div>
              )}
            </div>

            {rosterActionError && (
              <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
                <span>⚠️ {rosterActionError}</span>
                <button
                  onClick={() => setRosterActionError(null)}
                  className="btn-close"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}

            {registrations.length === 0 ? (
              <div className="empty-roster-state">
                <span className="empty-icon" aria-hidden="true">👥</span>
                <p className="empty-text">No attendees registered yet.</p>
                <p className="empty-subtext">
                  Be the first to join using the registration card on the right!
                </p>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="empty-roster-state">
                <p>No attendees matched "{rosterSearch}".</p>
              </div>
            ) : (
              <div className="roster-list">
                {filteredRegistrations.map((attendee) => {
                  const initials = getInitials(attendee.userId)
                  const avatarBg = getAvatarColor(attendee.userId)
                  const isRemovingThis = unregisteringUserId === attendee.userId

                  return (
                    <div key={attendee.userId} className="roster-item-card">
                      <div className="roster-user-info">
                        <div
                          className="attendee-avatar"
                          style={{ backgroundColor: avatarBg }}
                          aria-hidden="true"
                        >
                          {initials}
                        </div>
                        <div className="attendee-text-meta">
                          <span className="attendee-id-strong">
                            <code>{attendee.userId}</code>
                          </span>
                          <span className="attendee-registered-time">
                            Registered {formatDisplayDate(attendee.registeredAt)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRosterUnregister(attendee.userId)}
                        className="btn btn-sm btn-ghost-danger"
                        disabled={isRemovingThis}
                        title={`Unregister attendee ${attendee.userId}`}
                      >
                        {isRemovingThis ? 'Removing...' : 'Unregister'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar Column: Sticky Registration & Event Management */}
        <aside className="detail-sidebar-column">
          {/* Attendee Controls & Registration */}
          <AttendeeControls
            event={event}
            registrations={registrations}
            selectedUserId={selectedUserId}
            onSelectedUserIdChange={setSelectedUserId}
            onRegister={handleRegister}
            onUnregister={handleUnregister}
          />

          {/* Event Host Management Card */}
          <div className="host-management-card">
            <h3 className="card-title">Host Controls</h3>
            <p className="management-subtext">Manage event listing details and capacity.</p>

            <div className="host-actions-list">
              <Link to={`/events/${event.id}/edit`} className="btn btn-secondary btn-block">
                ✏️ Edit Event Details
              </Link>
              <button
                ref={deleteTriggerRef}
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="btn btn-danger-outline btn-block"
                disabled={isDeleting}
              >
                🗑️ Delete Event
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          ref={modalRef}
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-desc"
        >
          <div className="modal-card">
            <h3 id="modal-title">Delete Event</h3>
            <p id="modal-desc">
              Are you sure you want to permanently delete <strong>{event.title}</strong>?
            </p>
            <div className="modal-warning">
              ⚠️ This action is irreversible. All <strong>{registrations.length}</strong> attendee
              registration{registrations.length === 1 ? '' : 's'} will also be deleted immediately.
            </div>
            <div className="modal-actions">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={closeDeleteConfirm}
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
                {isDeleting ? 'Deleting Event...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
