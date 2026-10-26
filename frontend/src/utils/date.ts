/**
 * Timezone-aware date parsing, formatting, and conversion utilities.
 */

/**
 * Converts a browser datetime-local input string (YYYY-MM-DDTHH:mm) into an ISO UTC string.
 * Uses browser local time interpretation.
 */
export function localInputToIsoUtc(localString: string): string {
  if (!localString) return ''
  const date = new Date(localString)
  if (isNaN(date.getTime())) {
    throw new Error('Invalid local date string')
  }
  return date.toISOString()
}

/**
 * Converts an ISO UTC datetime string into local wall-clock components
 * for populating an HTML datetime-local input field (YYYY-MM-DDTHH:mm).
 * Avoids toISOString().slice(0,16) which produces UTC wall-clock values.
 */
export function isoUtcToLocalInput(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Formats an ISO UTC datetime string for human-readable display
 * with localized date, time, and timezone abbreviation.
 */
export function formatDisplayDate(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return 'Invalid date'

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

/**
 * Returns the IANA identifier of the browser's active timezone.
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
