export function formatSessions(ords: number[]): string {
  if (!ords.length) return '—'
  const list = ords.slice(0, 5).map((o) => `#${o}`).join(', ')
  return ords.length > 5 ? `${list}, …` : list
}
