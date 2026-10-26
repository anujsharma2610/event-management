import React from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventFormPage } from './pages/EventFormPage'
import { EventListPage } from './pages/EventListPage'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-navbar">
          <div className="navbar-container">
            <Link to="/" className="navbar-brand">
              <span className="brand-icon">📅</span>
              <span className="brand-text">EventFlow</span>
            </Link>

            <nav className="navbar-nav">
              <Link to="/" className="nav-link">
                Events
              </Link>
              <Link to="/events/new" className="btn btn-sm btn-primary">
                + New Event
              </Link>
            </nav>
          </div>
        </header>

        {/* Global status area for screen readers */}
        <div className="sr-only" aria-live="polite" aria-atomic="true" id="live-region"></div>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<EventListPage />} />
            <Route path="/events/new" element={<EventFormPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/events/:id/edit" element={<EventFormPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-container">
            <p>Event Management API Assessment • In-Memory Storage • FastAPI & React</p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
