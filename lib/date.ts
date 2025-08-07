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

export const endOfNextMonthAligned = (d: Date): Date => {
  const endNext = new Date(d.getFullYear(), d.getMonth() + 2, 0)
  if (isLastDayOfMonth(d)) return endNext
  const day = Math.min(d.getDate(), endNext.getDate())
  return new Date(d.getFullYear(), d.getMonth() + 1, day)
}

export const daysUntil = (target: Date): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  const diff = t.getTime() - today.getTime()
  return Math.round(diff / 86400000)
}
