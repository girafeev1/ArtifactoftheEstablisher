export type ProjectsSortMethod = 'year' | 'subsidiary'

const SEPARATOR = '--'

export interface SelectionDescriptor {
  type: ProjectsSortMethod
  year: string
}

export const encodeSelectionId = (
  type: ProjectsSortMethod,
  year: string
) => `${type}${SEPARATOR}${encodeURIComponent(year)}`

export const decodeSelectionId = (value: string): SelectionDescriptor | null => {
  const [typePart, yearPart] = value.split(SEPARATOR)
  if (!typePart || !yearPart) {
    return null
  }

  if (typePart !== 'year' && typePart !== 'subsidiary') {
    return null
  }

  try {
    return { type: typePart, year: decodeURIComponent(yearPart) }
  } catch {
    return null
  }
}
