export const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0]
}

export const toIsoUtcStringOrNull = (value: string) => {
  if (!value) return null
  const isoLocalMidnight = `${value}T00:00:00+08:00`
  const date = new Date(isoLocalMidnight)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const sanitizeText = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}
