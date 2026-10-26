import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')

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

  const filteredRegistrations = useMemo(() => {
    if (!rosterSearch.trim()) return registrations
    const q = rosterSearch.toLowerCase()
    return registrations.filter((r) => r.userId.toLowerCase().includes(q))
  }, [registrations, rosterSearch])

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

  const dateTile = getDateTileParts(event.date)

  return (
    <div className="page-container">
      {/* Top Navigation Bar */}
      <div className="detail-top-bar">
        <Link to="/" className="btn-back">
          ← Back to Events
        </Link>

        <div className="top-bar-right">
          <button
            onClick={() => loadData()}
            className="btn btn-sm btn-ghost"
            title="Refresh event data from server"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

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
              <h2 className="section-title">About this Event</h2>
              <div className="event-description-text">{event.description}</div>
            </section>
          )}

          {/* Attendees Roster Section (Partiful / Eventbrite Pattern) */}
          <section className="detail-content-card">
            <div className="roster-header-row">
              <div>
                <h2 className="section-title">Registered Attendees</h2>
                <p className="section-subtitle">
                  {registrations.length} confirmed participant
                  {registrations.length === 1 ? '' : 's'}
                </p>
              </div>

              {registrations.length > 0 && (
                <div className="roster-search-input">
                  <input
                    type="search"
                    placeholder="Search attendee by ID..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    aria-label="Filter registered attendees"
                  />
                </div>
              )}
            </div>

            {registrations.length === 0 ? (
              <div className="empty-roster-box">
                <div className="empty-roster-icon" aria-hidden="true">👥</div>
                <p className="empty-roster-title">No attendees yet</p>
                <p className="empty-roster-desc">
                  Be the first to register for this event using the registration card.
                </p>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="empty-roster-box">
                <p>No attendees matched "{rosterSearch}".</p>
              </div>
            ) : (
              <div className="roster-list">
                {filteredRegistrations.map((attendee) => {
                  const initials = getInitials(attendee.userId)
                  const avatarBg = getAvatarColor(attendee.userId)

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
                        onClick={() => handleUnregister(attendee.userId)}
                        className="btn btn-sm btn-ghost-danger"
                        title={`Unregister attendee ${attendee.userId}`}
                      >
                        Unregister
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
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-card">
            <h3 id="modal-title">Delete Event</h3>
            <p>
              Are you sure you want to permanently delete <strong>{event.title}</strong>?
            </p>
            <div className="modal-warning">
              ⚠️ This action is irreversible. All <strong>{registrations.length}</strong> attendee
              registration{registrations.length === 1 ? '' : 's'} will also be deleted immediately.
            </div>
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
                {isDeleting ? 'Deleting Event...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
