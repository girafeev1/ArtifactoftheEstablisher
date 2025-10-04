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

interface SequenceCandidate {
  original: string
  prefix: string
  value: number
  width: number
  matchesYear: boolean
}

const extractSequence = (text: string): Omit<SequenceCandidate, 'matchesYear'> | null => {
  const match = text.match(/(\d+)(?!.*\d)/)
  if (!match || match.index === undefined) {
    return null
  }
  const digits = match[1]
  const prefix = text.slice(0, match.index)
  const value = Number.parseInt(digits, 10)
  if (Number.isNaN(value)) {
    return null
  }
  return {
    original: text,
    prefix,
    value,
    width: digits.length,
  }
}

export const generateSequentialProjectNumber = (
  year: string | null,
  existingNumbers: readonly string[]
): string => {
  const trimmedYear = year?.trim() ?? ''
  const cleaned = existingNumbers
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  const parsed = cleaned
    .map((value) => {
      const sequence = extractSequence(value)
      if (!sequence) {
        return null
      }
      return {
        ...sequence,
        matchesYear:
          trimmedYear.length > 0 &&
          (value.startsWith(trimmedYear) || sequence.prefix.includes(trimmedYear)),
      } satisfies SequenceCandidate
    })
    .filter((candidate): candidate is SequenceCandidate => Boolean(candidate))

  const chooseCandidate = (candidates: SequenceCandidate[]): SequenceCandidate | null => {
    if (candidates.length === 0) {
      return null
    }
    return candidates.reduce((highest, current) =>
      current.value > highest.value ? current : highest
    )
  }

  const preferred = trimmedYear.length
    ? chooseCandidate(parsed.filter((candidate) => candidate.matchesYear))
    : null

  const fallback = chooseCandidate(parsed)

  const target = preferred ?? fallback

  if (target) {
    const nextValue = target.value + 1
    const padded = String(nextValue).padStart(target.width, '0')
    return `${target.prefix}${padded}`
  }

  const defaultPrefix = trimmedYear ? `${trimmedYear}-` : ''
  const defaultWidth = trimmedYear ? 3 : 3
  return `${defaultPrefix}${String(1).padStart(defaultWidth, '0')}`
}
