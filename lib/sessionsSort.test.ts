import { sessionsComparator } from './sessionsSort'

describe('sessionsComparator', () => {
  const rows = [
    { startMs: 1, sessionType: 'A', rateCharged: 200 },
    { startMs: 2, sessionType: 'B', rateCharged: 100 },
  ]

  test('sorts numeric columns', () => {
    const sorted = [...rows].sort(sessionsComparator('rateCharged', 'asc'))
    expect(sorted[0].rateCharged).toBe(100)
  })

  test('sorts text columns', () => {
    const sorted = [...rows].sort(sessionsComparator('sessionType', 'desc'))
    expect(sorted[0].sessionType).toBe('B')
  })
})

