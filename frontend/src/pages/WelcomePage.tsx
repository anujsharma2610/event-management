import React from 'react'
import { Link } from 'react-router-dom'

export const WelcomePage: React.FC = () => {
  return (
    <div className="page-container welcome-page-container">
      <div className="welcome-hero-card">
        <div className="welcome-hero-content">
          <span className="welcome-tag">Overview & Getting Started</span>
          <h1 className="page-heading">Event Management Workspace</h1>
          <p className="welcome-description">
            A fast, thread-safe platform for scheduling gatherings, enforcing atomic seat
            capacity, and managing attendee rosters with full timezone awareness.
          </p>

          <div className="welcome-actions">
            <Link to="/" className="btn btn-primary btn-lg">
              View events
            </Link>
            <Link to="/events/new" className="btn btn-secondary btn-lg">
              Create event
            </Link>
          </div>
        </div>
      </div>

      <div className="welcome-features-grid">
        <div className="welcome-feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <h2 className="feature-title">Event Lifecycle</h2>
          <p className="feature-text">
            Full CRUD operations with deterministic sorting by start date and assigned UUIDs.
            Deleting an event cascades immediately to all registrations.
          </p>
        </div>

        <div className="welcome-feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h2 className="feature-title">Atomic Seat Capacity</h2>
          <p className="feature-text">
            Thread-safe critical sections prevent overbooking under high concurrency. Duplicate
            registrations and past-event bookings are strictly rejected.
          </p>
        </div>

        <div className="welcome-feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h2 className="feature-title">Timezone Awareness</h2>
          <p className="feature-text">
            Dates entered in your local wall-clock time are automatically converted to UTC
            instants. Editing preserves exact microsecond timestamp precision.
          </p>
        </div>

        <div className="welcome-feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </div>
          <h2 className="feature-title">Light & Dark Appearance</h2>
          <p className="feature-text">
            Three-state preference (System, Light, Dark) persisted in browser storage. Switching
            appearance never remounts views or loses active form inputs.
          </p>
        </div>
      </div>

      <div className="welcome-seed-note">
        <div className="seed-note-content">
          <strong>Need sample data?</strong>
          <p>
            Start the backend server with <code>SEED_DEMO_DATA=true</code> to load three
            representative events: an open upcoming summit, a full workshop, and a past retrospective.
          </p>
        </div>
        <Link to="/" className="btn btn-sm btn-outline">
          Explore events
        </Link>
      </div>
    </div>
  )
}
