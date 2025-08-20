export function sessionSortValue(row: any, key: string): number | string {
  switch (key) {
    case 'date':
    case 'time':
      return row.startMs || 0
    case 'duration':
    case 'baseRate':
    case 'rateCharged':
      return Number(row[key]) || 0
    case 'payOn':
      return row.payOnMs || 0
    default:
      return (row[key] || '').toString().toLowerCase()
  }
}

export function sessionsComparator(
  key: string,
  dir: 'asc' | 'desc',
): (a: any, b: any) => number {
  return (a, b) => {
    const av = sessionSortValue(a, key)
    const bv = sessionSortValue(b, key)
    if (typeof av === 'number' && typeof bv === 'number') {
      return dir === 'asc' ? av - bv : bv - av
    }
    return dir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  }
}

