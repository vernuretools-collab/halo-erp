/** Productive day is 8h. Lunch is a separate 1h break, so a full day is 9h logged. */
export const PRODUCTIVE_DAY_HOURS = 8
export const LUNCH_BREAK_HOURS = 1

export const TIMELINE_ENTRY_TYPES = [
  { id: 'work', label: 'Work', productive: true },
  { id: 'meeting', label: 'Meeting', productive: true },
  { id: 'shoot', label: 'Shoot', productive: true },
  { id: 'upskilling', label: 'Upskilling', productive: true },
  { id: 'extra_break', label: 'Extra break', productive: false },
]

const TYPE_IDS = new Set(TIMELINE_ENTRY_TYPES.map((type) => type.id))

export function normalizeEntryType(entryType) {
  return TYPE_IDS.has(entryType) ? entryType : 'work'
}

export function entryTypeLabel(entryType) {
  const id = normalizeEntryType(entryType)
  return TIMELINE_ENTRY_TYPES.find((type) => type.id === id)?.label || 'Work'
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
