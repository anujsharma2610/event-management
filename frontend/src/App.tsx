import React from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventFormPage } from './pages/EventFormPage'
import { EventListPage } from './pages/EventListPage'
import { WelcomePage } from './pages/WelcomePage'
import { ThemePreference, useTheme } from './utils/theme'

export const App: React.FC = () => {
  const { preference, setTheme } = useTheme()

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-navbar">
          <div className="navbar-container">
            <Link to="/" className="navbar-brand">
              <span className="brand-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </span>
              <span className="brand-text">EventFlow</span>
            </Link>

            <div className="navbar-actions">
              <div className="theme-selector-wrap">
                <label htmlFor="theme-select" className="theme-select-label">
                  <span className="theme-icon" aria-hidden="true">
                    {preference === 'dark' ? '🌙' : preference === 'light' ? '☀️' : '💻'}
                  </span>
                  <span className="sr-only">Theme appearance</span>
                </label>
                <select
                  id="theme-select"
                  className="theme-select"
                  aria-label="Theme appearance"
                  value={preference}
                  onChange={(e) => setTheme(e.target.value as ThemePreference)}
                >
                  <option value="system">Theme: System</option>
                  <option value="light">Theme: Light</option>
                  <option value="dark">Theme: Dark</option>
                </select>
              </div>

              <nav className="navbar-nav">
                <Link to="/" className="nav-link">
                  Events
                </Link>
                <Link to="/welcome" className="nav-link">
                  Guide
                </Link>
                <Link to="/events/new" className="btn btn-sm btn-primary">
                  + New Event
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Global status area for screen readers */}
        <div className="sr-only" aria-live="polite" aria-atomic="true" id="live-region"></div>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<EventListPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/events/new" element={<EventFormPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/events/:id/edit" element={<EventFormPage />} />
            <Route
              path="*"
              element={
                <div className="page-container not-found-page">
                  <div className="state-card not-found-state" role="alert">
                    <span className="not-found-code">404</span>
                    <h3>Page Not Found</h3>
                    <p className="error-message">
                      The requested URL does not match any known event routes.
                    </p>
                    <div className="form-actions">
                      <Link to="/" className="btn btn-primary">
                        Return to Events
                      </Link>
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-container">
            <p>Event Management API Assessment | In-Memory Storage | FastAPI & React</p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
