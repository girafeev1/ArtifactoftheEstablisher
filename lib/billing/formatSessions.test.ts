import { formatSessions } from './formatSessions'

describe('formatSessions', () => {
  test('formats ordinals with truncation', () => {
    expect(formatSessions([])).toBe('—')
    expect(formatSessions([1, 2, 3])).toBe('#1, #2, #3')
    expect(formatSessions([1, 2, 3, 4, 5, 6, 7])).toBe(
      '#1, #2, #3, #4, #5, …',
    )
  })
})
