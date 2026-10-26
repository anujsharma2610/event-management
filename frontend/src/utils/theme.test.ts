import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  getStoredThemePreference,
  getSystemTheme,
  resolveTheme,
  setStoredThemePreference,
  THEME_STORAGE_KEY,
} from './theme'

describe('Theme utilities', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getStoredThemePreference', () => {
    it('defaults to system when no saved preference exists', () => {
      expect(getStoredThemePreference()).toBe('system')
    })

    it('returns light when saved in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      expect(getStoredThemePreference()).toBe('light')
    })

    it('returns dark when saved in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      expect(getStoredThemePreference()).toBe('dark')
    })

    it('returns system when explicitly saved in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'system')
      expect(getStoredThemePreference()).toBe('system')
    })

    it('safely falls back to system on invalid stored values', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'invalid-value')
      expect(getStoredThemePreference()).toBe('system')
    })

    it('safely falls back to system when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: Access is denied')
      })
      expect(getStoredThemePreference()).toBe('system')
    })
  })

  describe('setStoredThemePreference', () => {
    it('persists preference to localStorage', () => {
      setStoredThemePreference('dark')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    })

    it('safely catches and ignores localStorage write exceptions', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => setStoredThemePreference('light')).not.toThrow()
    })
  })

  describe('getSystemTheme and resolveTheme', () => {
    it('resolves system to dark when OS prefers dark', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      expect(getSystemTheme()).toBe('dark')
      expect(resolveTheme('system')).toBe('dark')
    })

    it('resolves system to light when OS prefers light', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      expect(getSystemTheme()).toBe('light')
      expect(resolveTheme('system')).toBe('light')
    })

    it('explicit light overrides dark OS setting', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      expect(resolveTheme('light')).toBe('light')
    })

    it('explicit dark overrides light OS setting', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      expect(resolveTheme('dark')).toBe('dark')
    })
  })

  describe('applyTheme', () => {
    it('sets data-theme and colorScheme on documentElement', () => {
      applyTheme('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(document.documentElement.style.colorScheme).toBe('dark')

      applyTheme('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(document.documentElement.style.colorScheme).toBe('light')
    })
  })
})
