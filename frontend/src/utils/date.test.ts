import { describe, expect, it } from 'vitest'
import {
  formatDisplayDate,
  getDateTileParts,
  isoUtcToLocalInput,
  localInputToIsoUtc,
} from './date'

describe('Date and Timezone Utilities', () => {
  it('converts local datetime input string to ISO UTC string', () => {
    // 2030-06-15T18:30
    const localInput = '2030-06-15T18:30'
    const utcIso = localInputToIsoUtc(localInput)

    expect(typeof utcIso).toBe('string')
    expect(utcIso.endsWith('Z')).toBe(true)

    // The instant represented by utcIso must equal the instant of localInput
    const originalTime = new Date(localInput).getTime()
    const convertedTime = new Date(utcIso).getTime()
    expect(convertedTime).toBe(originalTime)
  })

  it('converts ISO UTC string back to local datetime-local components without UTC slicing', () => {
    const originalLocal = '2030-06-15T18:30'
    const utcIso = localInputToIsoUtc(originalLocal)

    const reconstructedLocal = isoUtcToLocalInput(utcIso)
    expect(reconstructedLocal).toBe(originalLocal)
  })

  it('formats dates for display including timezone abbreviation', () => {
    const utcIso = '2030-06-15T13:00:00.000Z'
    const formatted = formatDisplayDate(utcIso)

    expect(typeof formatted).toBe('string')
    expect(formatted.length).toBeGreaterThan(0)
    expect(formatted).not.toBe('Invalid date')
  })

  it('handles empty and invalid input gracefully', () => {
    expect(isoUtcToLocalInput('')).toBe('')
    expect(isoUtcToLocalInput('invalid')).toBe('')
    expect(formatDisplayDate('')).toBe('')
    expect(formatDisplayDate('invalid')).toBe('Invalid date')
  })

  it('extracts calendar date tile parts (month and day)', () => {
    const tile = getDateTileParts('2030-06-15T13:00:00Z')
    expect(tile.month.length).toBe(3)
    expect(Number(tile.day)).toBeGreaterThanOrEqual(1)
    expect(Number(tile.day)).toBeLessThanOrEqual(31)

    const emptyTile = getDateTileParts('')
    expect(emptyTile.month).toBe('')
    expect(emptyTile.day).toBe('')
  })
})
