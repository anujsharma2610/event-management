import React, { useState } from 'react'
import { ApiError } from '../api/client'
import { EventWrite } from '../api/types'
import { getBrowserTimezone, isoUtcToLocalInput, localInputToIsoUtc } from '../utils/date'

interface EventFormProps {
  initialValues?: EventWrite
  isEditing?: boolean
  onSubmit: (data: EventWrite) => Promise<void>
  onCancel: () => void
}

interface FormErrors {
  title?: string
  description?: string
  date?: string
  maxCapacity?: string
  general?: string
}

export const EventForm: React.FC<EventFormProps> = ({
  initialValues,
  isEditing = false,
  onSubmit,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialValues?.title || '')
  const [description, setDescription] = useState(initialValues?.description || '')
  const [localDate, setLocalDate] = useState(() =>
    initialValues?.date ? isoUtcToLocalInput(initialValues.date) : '',
  )
  const [maxCapacity, setMaxCapacity] = useState(
    initialValues?.maxCapacity ? String(initialValues.maxCapacity) : '30',
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const timezone = getBrowserTimezone()

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      newErrors.title = 'Title is required.'
    } else if (trimmedTitle.length > 120) {
      newErrors.title = 'Title cannot exceed 120 characters.'
    }

    if (description.length > 2000) {
      newErrors.description = 'Description cannot exceed 2000 characters.'
    }

    if (!localDate) {
      newErrors.date = 'Date and time are required.'
    } else {
      try {
        const parsedUtc = localInputToIsoUtc(localDate)
        if (!parsedUtc) newErrors.date = 'Invalid date and time.'
      } catch {
        newErrors.date = 'Invalid date and time.'
      }
    }

    const capNum = Number(maxCapacity)
    if (!maxCapacity || isNaN(capNum) || !Number.isInteger(capNum)) {
      newErrors.maxCapacity = 'Capacity must be a whole number.'
    } else if (capNum < 1) {
      newErrors.maxCapacity = 'Capacity must be at least 1.'
    } else if (capNum > 10000) {
      newErrors.maxCapacity = 'Capacity cannot exceed 10,000.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setErrors((prev) => ({ ...prev, general: undefined }))

    try {
      // F07: If the formatted local date string matches the initial formatted date,
      // preserve the exact original raw UTC timestamp to prevent precision truncation.
      const isDateUntouched =
        initialValues?.date &&
        isoUtcToLocalInput(initialValues.date) === localDate
      const finalDate = isDateUntouched
        ? initialValues.date
        : localInputToIsoUtc(localDate)

      await onSubmit({
        title: title.trim(),
        description,
        date: finalDate,
        maxCapacity: Number(maxCapacity),
      })
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.details && err.details.length > 0) {
          const fieldErrors: FormErrors = {}
          err.details.forEach((d) => {
            if (d.field === 'title') fieldErrors.title = d.message
            else if (d.field === 'description') fieldErrors.description = d.message
            else if (d.field === 'date') fieldErrors.date = d.message
            else if (d.field === 'maxCapacity') fieldErrors.maxCapacity = d.message
            else fieldErrors.general = d.message
          })
          setErrors(fieldErrors)
        } else {
          setErrors({ general: err.message })
        }
      } else {
        setErrors({ general: 'An unexpected error occurred. Please try again.' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="event-form-v2" noValidate>
      {errors.general && (
        <div className="alert alert-error" role="alert">
          <span>{errors.general}</span>
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="form-section">
        <div className="section-header">
          <h2 className="section-heading">Basic Information</h2>
          <p className="section-subtext">Name your event and provide an agenda or summary.</p>
        </div>

        <div className="form-group">
          <label htmlFor="event-title">
            Event Title <span className="required">*</span>
          </label>
          <input
            id="event-title"
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Distributed Systems Architecture Summit"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'event-title-error' : undefined}
            disabled={isSubmitting}
            required
          />
          <div className="input-helper-row">
            <span className="input-hint">Maximum 120 characters</span>
            <span className="character-count">{title.trim().length} / 120</span>
          </div>
          {errors.title && (
            <p id="event-title-error" className="field-error" role="alert">
              {errors.title}
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="event-description">Event Description</label>
          <textarea
            id="event-description"
            value={description}
            maxLength={2000}
            rows={4}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed agenda, speaker notes, or meeting location details..."
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'event-description-error' : undefined}
            disabled={isSubmitting}
          />
          <div className="input-helper-row">
            <span className="input-hint">Optional, up to 2,000 characters</span>
            <span className="character-count">{description.length} / 2000</span>
          </div>
          {errors.description && (
            <p id="event-description-error" className="field-error" role="alert">
              {errors.description}
            </p>
          )}
        </div>
      </div>

      {/* Section 2: Date & Time */}
      <div className="form-section">
        <div className="section-header">
          <h2 className="section-heading">Date, Time & Timezone</h2>
          <p className="section-subtext">Specify the start instant. Registrations will close at this time.</p>
        </div>

        <div className="timezone-callout">
          <div className="timezone-callout-text">
            <strong>Timezone: {timezone}</strong>
            <p>
              Dates entered in your local wall-clock time will be automatically converted to UTC
              instants when saved.
            </p>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="event-date">
            Event Date & Time <span className="required">*</span>
          </label>
          <input
            id="event-date"
            type="datetime-local"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? 'event-date-error' : undefined}
            disabled={isSubmitting}
            required
          />
          {errors.date && (
            <p id="event-date-error" className="field-error" role="alert">
              {errors.date}
            </p>
          )}
        </div>
      </div>

      {/* Section 3: Capacity */}
      <div className="form-section">
        <div className="section-header">
          <h2 className="section-heading">Capacity & Reservation Limits</h2>
          <p className="section-subtext">Set the maximum number of attendee registrations allowed.</p>
        </div>

        <div className="form-group">
          <label htmlFor="event-capacity">
            Maximum Capacity <span className="required">*</span>
          </label>
          <input
            id="event-capacity"
            type="number"
            min="1"
            max="10000"
            step="1"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
            placeholder="1 to 10000"
            aria-invalid={!!errors.maxCapacity}
            aria-describedby={errors.maxCapacity ? 'event-capacity-error' : undefined}
            disabled={isSubmitting}
            required
          />
          <span className="input-hint">
            Must be a whole number between 1 and 10,000. When editing, capacity cannot be reduced below current attendee count.
          </span>
          {errors.maxCapacity && (
            <p id="event-capacity-error" className="field-error" role="alert">
              {errors.maxCapacity}
            </p>
          )}
        </div>
      </div>

      {/* Form Action Bar */}
      <div className="form-actions-bar">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting
            ? isEditing
              ? 'Saving Changes...'
              : 'Creating Event...'
            : isEditing
              ? 'Save Changes'
              : 'Create Event'}
        </button>
      </div>
    </form>
  )
}
