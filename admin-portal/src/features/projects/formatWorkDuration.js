/** Decimal hours → "39 mins" or "1hr 12 min". */
export function formatWorkDuration(hours) {
  const totalMinutes = Math.round(Number(hours) * 60)
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0 mins'

  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h === 0) return m === 1 ? '1 min' : `${m} mins`
  if (m === 0) return `${h}hr`
  return `${h}hr ${m} min`
}

export function formatLoggedVsEstimate(loggedHours, estimatedHours) {
  return `${formatWorkDuration(loggedHours)} / ${formatWorkDuration(estimatedHours)}`
}
