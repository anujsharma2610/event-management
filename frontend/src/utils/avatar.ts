/**
 * Deterministic avatar color and initials generation for attendee representations.
 */

const AVATAR_COLORS = [
  '#4f46e5', // indigo
  '#0284c7', // sky
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#ea580c', // orange
  '#0d9488', // teal
  '#475569', // slate
  '#2563eb', // blue
]

export function getInitials(userId: string): string {
  if (!userId) return '?'
  // If format is attendee-001 or similar, extract the meaningful part
  const parts = userId.split(/[-_]/)
  if (parts.length > 1 && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return userId.slice(0, 2).toUpperCase()
}

export function getAvatarColor(userId: string): string {
  if (!userId) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}
