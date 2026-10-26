import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, ApiError } from '../api/client'
import { Event } from '../api/types'
import { formatDisplayDate } from '../utils/date'

export const EventListPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getEvents(signal)
      setEvents(response.items)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load events. Please check server connection.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchEvents(controller.signal)
    return () => controller.abort()
  }, [])

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
      <div className="page-header">
        <div>
          <h2>All Events</h2>
          <p className="subtitle">
            Browse upcoming conferences, workshops, and team gatherings.
          </p>
        </div>
        <Link to="/events/new" className="btn btn-primary">
          + Create Event
        </Link>
      </div>

      {isLoading && (
        <div className="state-card loading-state" role="status">
          <div className="spinner" aria-hidden="true"></div>
          <p>Loading events...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="state-card error-state" role="alert">
          <p className="error-message">{error}</p>
          <button onClick={() => fetchEvents()} className="btn btn-secondary">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="state-card empty-state">
          <h3>No events found</h3>
          <p>Get started by creating your first event.</p>
          <Link to="/events/new" className="btn btn-primary">
            Create Event
          </Link>
        </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <div className="events-grid">
          {events.map((event) => (
            <article key={event.id} className="event-card">
              <div className="event-card-header">
                <span className={getStatusBadgeClass(event.status)}>
                  {event.status.toUpperCase()}
                </span>
                <span className="capacity-pill">
                  {event.registrationCount} / {event.maxCapacity} seats
                </span>
              </div>

              <h3 className="event-card-title">
                <Link to={`/events/${event.id}`}>{event.title}</Link>
              </h3>

              <p className="event-card-date">
                📅 {formatDisplayDate(event.date)}
              </p>

              {event.description && (
                <p className="event-card-description">{event.description}</p>
              )}

              <div className="event-card-actions">
                <Link to={`/events/${event.id}`} className="btn btn-sm btn-outline">
                  View Details
                </Link>
                <Link to={`/events/${event.id}/edit`} className="btn btn-sm btn-ghost">
                  Edit
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
