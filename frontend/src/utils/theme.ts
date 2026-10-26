/**
 * Theme management for System, Light, and Dark preferences.
 * Persists user preference under 'event-management:theme'.
 */

import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'event-management:theme'

/**
 * Read the saved theme preference from localStorage.
 * Falls back to 'system' if missing, invalid, or if storage access throws.
 */
export function getStoredThemePreference(): ThemePreference {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'system'
    }
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }
    return 'system'
  } catch {
    return 'system'
  }
}

/**
 * Persist the theme preference to localStorage.
 * Safely ignores storage write errors (e.g. private mode, quota exceeded).
 */
export function setStoredThemePreference(preference: ThemePreference): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    }
  } catch {
    // Storage unavailable or throwing; preference remains active in session state.
  }
}

/**
 * Query the operating system's prefers-color-scheme setting.
 */
export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

/**
 * Resolve an appearance preference ('system' | 'light' | 'dark')
 * into the concrete theme ('light' | 'dark').
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme()
  }
  return preference
}

/**
 * Apply the resolved theme to document root with data-theme attribute
 * and style.colorScheme for native inputs and scrollbars.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved
}

/**
 * React hook to manage theme preference, resolve system appearance,
 * and synchronize with media queries and cross-tab storage changes.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredThemePreference())
  )

  const setTheme = useCallback((newPreference: ThemePreference) => {
    setPreference(newPreference)
    const nextResolved = resolveTheme(newPreference)
    setResolvedTheme(nextResolved)
    setStoredThemePreference(newPreference)
    applyTheme(nextResolved)
  }, [])

  useEffect(() => {
    // Apply current resolved theme on mount
    const initialResolved = resolveTheme(preference)
    setResolvedTheme(initialResolved)
    applyTheme(initialResolved)

    // Listen for OS preference changes
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = () => {
      // If current preference is 'system', update resolved appearance
      const currentPref = getStoredThemePreference()
      if (currentPref === 'system') {
        const nextResolved = mediaQuery.matches ? 'dark' : 'light'
        setResolvedTheme(nextResolved)
        applyTheme(nextResolved)
      }
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange)
    }

    // Listen for cross-tab storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null) {
        const updatedPref = getStoredThemePreference()
        setPreference(updatedPref)
        const nextResolved = resolveTheme(updatedPref)
        setResolvedTheme(nextResolved)
        applyTheme(nextResolved)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMediaChange)
      }
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [preference])

  return { preference, resolvedTheme, setTheme }
}
