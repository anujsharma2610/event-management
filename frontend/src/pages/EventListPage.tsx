import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, ApiError } from '../api/client'
import { Event } from '../api/types'
import { formatDisplayDate, getDateTileParts } from '../utils/date'

type FilterTab = 'all' | 'upcoming' | 'past'

export const EventListPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchEvents = async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getEvents(signal)
      setEvents(response?.items ?? [])
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

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Tab filter
      if (activeTab === 'upcoming' && event.status === 'past') return false
      if (activeTab === 'past' && event.status !== 'past') return false

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchesTitle = event.title.toLowerCase().includes(q)
        const matchesDesc = event.description.toLowerCase().includes(q)
        if (!matchesTitle && !matchesDesc) return false
      }

      return true
    })
  }, [events, activeTab, searchQuery])

  const upcomingCount = useMemo(
    () => events.filter((e) => e.status !== 'past').length,
    [events],
  )
  const pastCount = useMemo(
    () => events.filter((e) => e.status === 'past').length,
    [events],
  )

  const getStatusBadge = (status: Event['status']) => {
    switch (status) {
      case 'upcoming':
        return (
          <span className="badge badge-upcoming">
            <span className="badge-dot" aria-hidden="true"></span>
            Upcoming
          </span>
        )
      case 'full':
        return (
          <span className="badge badge-full">
            <span className="badge-dot" aria-hidden="true"></span>
            Full
          </span>
        )
      case 'past':
        return (
          <span className="badge badge-past">
            <span className="badge-dot" aria-hidden="true"></span>
            Past
          </span>
        )
    }
  }

  return (
    <div className="page-container">
      {/* Directory Header */}
      <div className="directory-header">
        <div className="directory-header-content">
          <h1 className="page-heading">Events</h1>
          <p className="directory-subtitle">
            {events.length === 1 ? '1 event scheduled' : `${events.length} events scheduled`}
          </p>
        </div>
        <Link to="/events/new" className="btn btn-primary btn-lg">
          Create event
        </Link>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="list-controls-bar">
        <div className="filter-tabs" role="group" aria-label="Event category filters">
          <button
            type="button"
            aria-pressed={activeTab === 'all'}
            className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All <span className="tab-count">{events.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'upcoming'}
            className={`filter-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming <span className="tab-count">{upcomingCount}</span>
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'past'}
            className={`filter-tab ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past <span className="tab-count">{pastCount}</span>
          </button>
        </div>

        <div className="search-box">
          <span className="search-icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search events by title or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search events"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="state-card loading-state" role="status">
          <div className="spinner" aria-hidden="true"></div>
          <p>Loading events...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="state-card error-state" role="alert">
          <p className="error-message">{error}</p>
          <button onClick={() => fetchEvents()} className="btn btn-secondary">
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && events.length === 0 && (
        <div className="state-card empty-state">
          <h3>No events found</h3>
          <p>Get started by creating your first event.</p>
          <Link to="/events/new" className="btn btn-primary">
            Create event
          </Link>
        </div>
      )}

      {/* Filtered Empty State */}
      {!isLoading && !error && events.length > 0 && filteredEvents.length === 0 && (
        <div className="state-card empty-state">
          <h3>No matching events</h3>
          <p>No events matched your search query or selected category filter.</p>
          <button
            onClick={() => {
              setActiveTab('all')
              setSearchQuery('')
            }}
            className="btn btn-secondary"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Events Grid */}
      {!isLoading && !error && filteredEvents.length > 0 && (
        <div className="events-grid">
          {filteredEvents.map((event) => {
            const tile = getDateTileParts(event.date)
            const occupancyPct = Math.min(
              100,
              Math.round((event.registrationCount / event.maxCapacity) * 100),
            )

            return (
              <article key={event.id} className="event-card-v2">
                <div className="event-card-top">
                  {/* Calendar Date Tile */}
                  <div className="date-tile" aria-hidden="true">
                    <span className="date-tile-month">{tile.month}</span>
                    <span className="date-tile-day">{tile.day}</span>
                  </div>

                  <div className="event-card-main-meta">
                    <div className="event-card-status-row">
                      {getStatusBadge(event.status)}
                    </div>
                    <h2 className="event-card-title">
                      <Link to={`/events/${event.id}`}>{event.title}</Link>
                    </h2>
                    <p className="event-card-time-row">
                      {formatDisplayDate(event.date)}
                    </p>
                  </div>
                </div>

                {event.description && (
                  <p className="event-card-description">{event.description}</p>
                )}

                {/* Capacity Progress Bar & Label */}
                <div className="capacity-section">
                  <div className="capacity-labels">
                    <span className="capacity-text">
                      {event.status === 'past' ? (
                        <>Registration closed ({event.registrationCount} attended)</>
                      ) : event.status === 'full' ? (
                        <>Full ({event.maxCapacity} of {event.maxCapacity} registered)</>
                      ) : (
                        <>
                          <strong>{event.remainingCapacity}</strong>{' '}
                          {event.remainingCapacity === 1 ? 'spot left' : 'spots left'}{' '}
                          <span className="capacity-subcount">
                            ({event.registrationCount} of {event.maxCapacity} registered)
                          </span>
                        </>
                      )}
                    </span>
                    <span className="capacity-pct">{occupancyPct}%</span>
                  </div>
                  <div
                    className="capacity-track"
                    role="progressbar"
                    aria-valuenow={event.registrationCount}
                    aria-valuemin={0}
                    aria-valuemax={event.maxCapacity}
                    aria-label="Event capacity booked"
                  >
                    <div
                      className={`capacity-fill fill-${event.status}`}
                      style={{ width: `${occupancyPct}%` }}
                    ></div>
                  </div>
                </div>

                <div className="event-card-actions">
                  <Link to={`/events/${event.id}`} className="btn btn-sm btn-outline">
                    {event.status === 'past' ? 'View event' : 'View details'}
                  </Link>
                  <Link to={`/events/${event.id}/edit`} className="btn btn-sm btn-ghost">
                    Edit
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
