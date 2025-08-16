import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

dayjs.tz.setDefault('Asia/Hong_Kong')

export function toHKMidnight(d: Date): Date {
  return dayjs(d).tz('Asia/Hong_Kong').startOf('day').toDate()
}
