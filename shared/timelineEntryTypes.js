/** Productive day is 8h. Lunch is a separate 1h break, so a full day is 9h logged. */
export const PRODUCTIVE_DAY_HOURS = 8
export const LUNCH_BREAK_HOURS = 1

export const TIMELINE_ENTRY_TYPES = [
  { id: 'work', label: 'Work', productive: true },
  { id: 'upskilling', label: 'Upskilling', productive: true },
  { id: 'work_activities', label: 'Work Activities', productive: true },
]

/** Older activity logs that now sit under Work Activities. */
const WORK_ACTIVITY_ALIASES = new Set([
  'meeting',
  'shoot',
  'discussion',
  'on_duty',
  'onduty',
])

const LEGACY_LABELS = {
  extra_break: 'Extra break',
}

const TYPE_IDS = new Set(TIMELINE_ENTRY_TYPES.map((type) => type.id))

export function normalizeEntryType(entryType) {
  const raw = String(entryType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (TYPE_IDS.has(raw)) return raw
  if (raw === 'extra_break' || raw === 'extrabreak') return 'extra_break'
  if (WORK_ACTIVITY_ALIASES.has(raw)) return 'work_activities'
  return 'work'
}

export function entryTypeLabel(entryType) {
  const id = normalizeEntryType(entryType)
  return TIMELINE_ENTRY_TYPES.find((type) => type.id === id)?.label || LEGACY_LABELS[id] || 'Work'
}

export function isProductiveEntryType(entryType) {
  return normalizeEntryType(entryType) !== 'extra_break'
}

export function sumEntryHours(entries, predicate) {
  return (entries || []).reduce((sum, entry) => {
    if (predicate && !predicate(entry)) return sum
    return sum + (Number(entry.hours) || 0)
  }, 0)
}
