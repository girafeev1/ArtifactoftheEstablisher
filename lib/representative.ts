export type RepresentativeInfo = {
  title: string | null
  firstName: string | null
  lastName: string | null
}

const sanitize = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const TITLE_TOKENS = new Set([
  'mr',
  'mr.',
  'ms',
  'ms.',
  'mrs',
  'mrs.',
  'dr',
  'dr.',
  'prof',
  'prof.',
])

const splitWhitespace = (value: string) => value.trim().split(/\s+/).filter(Boolean)

export const parseRepresentativeString = (raw: string): RepresentativeInfo => {
  const trimmed = raw.trim()
  if (!trimmed) return { title: null, firstName: null, lastName: null }

  const parts = splitWhitespace(trimmed)
  if (parts.length === 0) return { title: null, firstName: null, lastName: null }

  let title: string | null = null
  let nameParts = parts

  const firstToken = parts[0] ?? ''
  const firstTokenKey = firstToken.toLowerCase()
  if (TITLE_TOKENS.has(firstTokenKey)) {
    title = firstToken
    nameParts = parts.slice(1)
  }

  if (nameParts.length === 0) {
    return { title, firstName: null, lastName: null }
  }
  if (nameParts.length === 1) {
    return { title, firstName: nameParts[0] ?? null, lastName: null }
  }

  const lastName = nameParts[nameParts.length - 1] ?? null
  const firstName = nameParts.slice(0, -1).join(' ').trim() || null
  return { title, firstName, lastName }
}

export const normalizeRepresentative = (input: unknown): RepresentativeInfo | null => {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null
    return parseRepresentativeString(trimmed)
  }

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const record = input as Record<string, unknown>
    const title = sanitize(record.title)
    const firstName = sanitize(record.firstName)
    const lastName = sanitize(record.lastName)
    if (!title && !firstName && !lastName) return null
    return { title, firstName, lastName }
  }

  return null
}

export const representativeToDisplay = (rep: RepresentativeInfo | null | undefined): string | null => {
  if (!rep) return null
  const parts = [rep.title, rep.firstName, rep.lastName].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  return parts.length > 0 ? parts.join(' ') : null
}

export const representativeNameOnly = (rep: RepresentativeInfo | null | undefined): string | null => {
  if (!rep) return null
  const parts = [rep.firstName, rep.lastName].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  return parts.length > 0 ? parts.join(' ') : null
}

