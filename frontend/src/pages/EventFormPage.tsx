import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiClient, ApiError } from '../api/client'
import { EventWrite } from '../api/types'
import { EventForm } from '../components/EventForm'

export const EventFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const [initialValues, setInitialValues] = useState<EventWrite | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setInitialValues(undefined)
      setIsLoading(false)
      setLoadError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setLoadError(null)

    apiClient
      .getEvent(id, controller.signal)
      .then((event) => {
        setInitialValues({
          title: event.title,
          description: event.description,
          date: event.date,
          maxCapacity: event.maxCapacity,
        })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError) {
          setLoadError(err.message)
        } else {
          setLoadError('Failed to load event data for editing.')
        }
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [id])

  const handleSubmit = async (data: EventWrite) => {
    if (isEditing && id) {
      await apiClient.updateEvent(id, data)
      navigate(`/events/${id}`)
    } else {
      const created = await apiClient.createEvent(data)
      navigate(`/events/${created.id}`)
    }
  }

  const handleCancel = () => {
    if (isEditing && id) {
      navigate(`/events/${id}`)
    } else {
      navigate('/')
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="state-card loading-state" role="status">
          <div className="spinner" aria-hidden="true"></div>
          <p>Loading event for editing...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-container">
        <div className="state-card error-state" role="alert">
          <h3>Error Loading Event</h3>
          <p className="error-message">{loadError}</p>
          <Link to="/" className="btn btn-secondary">
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container form-page-container">
      <div className="form-page-header">
        <Link to={isEditing && id ? `/events/${id}` : '/'} className="btn-back">
          ← {isEditing ? 'Back to Details' : 'Back to Events'}
        </Link>
        <h1 className="page-heading">{isEditing ? 'Edit Event' : 'Create New Event'}</h1>
        <p className="subtitle">
          {isEditing
            ? 'Update event details and capacity settings.'
            : 'Fill in the information below to schedule a new event.'}
        </p>
      </div>

      <div className="form-card-v2">
        <EventForm
          key={id ?? 'create'}
          initialValues={isEditing ? initialValues : undefined}
          isEditing={isEditing}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
