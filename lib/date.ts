export const formatMMMDDYYYY = (d: Date): string => {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

export const isLastDayOfMonth = (d: Date): boolean => {
  const test = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return d.getDate() === test.getDate()
}

export const endOfNextMonthAligned = (start: Date): Date => {
  const y = start.getFullYear()
  const m = start.getMonth()
  const d = start.getDate()

  // candidate: same day next month
  const sameDayNext = new Date(y, m + 1, d)
  // If month rolled (day doesn't exist), fallback to last day of next month
  const lastOfNext = new Date(y, m + 2, 0)

  let end: Date
  if (sameDayNext.getMonth() === (m + 1) % 12) {
    // use the day BEFORE the same-day-next-month
    end = new Date(y, m + 1, d - 1)
  } else {
    // e.g., Jan 31 -> Feb doesn't have 31 -> end = last day of next month
    end = lastOfNext
  }
  end.setHours(23, 59, 59, 0)
  return end
}

export const daysUntil = (target: Date): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  const diff = t.getTime() - today.getTime()
  return Math.round(diff / 86400000)
}
