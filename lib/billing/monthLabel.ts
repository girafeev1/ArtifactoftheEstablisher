export function monthLabelFor(start: number | Date): string {
  const d =
    typeof start === 'number'
      ? new Date(start)
      : new Date(start.getTime())
  if (d.getDate() >= 21) d.setMonth(d.getMonth() + 1)
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

