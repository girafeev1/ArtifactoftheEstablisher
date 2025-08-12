import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { PATHS, logPath } from '../paths'
import { computeSessionStart } from '../sessions'

interface RetainerWindow {
  start: Date
  end: Date
}

interface BaseRateEntry {
  rate: number
  ts: Date
}

const inRetainer = (startMs: number, retainers: RetainerWindow[]) =>
  retainers.some(
    (r) => startMs >= r.start.getTime() && startMs <= r.end.getTime(),
  )

const effectiveBaseRate = (
  startMs: number,
  baseRates: BaseRateEntry[],
): number => {
  const entry = baseRates.filter((b) => b.ts.getTime() <= startMs).pop()
  return entry ? Number(entry.rate) || 0 : 0
}

const latestVoucherUsed = (voucherDocs: any[]): boolean => {
  if (!voucherDocs.length) return false
  const sorted = voucherDocs
    .map((v) => {
      const data = v.data ? v.data() : v
      const ts =
        data.timestamp?.toDate?.()?.getTime() ??
        new Date(data.timestamp).getTime() ??
        0
      return { ...data, ts }
    })
    .sort((a, b) => a.ts - b.ts)
  const latest = sorted[sorted.length - 1]
  return !!latest && (latest['free?'] === true || latest.free === true)
}

export async function computeBalanceDue(
  abbr: string,
  account: string,
): Promise<number> {
  const sessionsPath = PATHS.sessions
  const paymentsPath = PATHS.payments(abbr)
  const baseHistPath = PATHS.baseRateHistory(abbr)
  const basePath = PATHS.baseRate(abbr)
  const retainersPath = PATHS.retainers(abbr)

  logPath('sessionsQuery', sessionsPath)
  const [sessionsSnap, paymentsSnap, baseHistSnap, baseSnap, retSnap] =
    await Promise.all([
      getDocs(query(collection(db, sessionsPath), where('sessionName', '==', account))),
      getDocs(collection(db, paymentsPath)),
      getDocs(collection(db, baseHistPath)),
      getDocs(collection(db, basePath)),
      getDocs(collection(db, retainersPath)),
    ])

  const baseRates: BaseRateEntry[] = [...baseHistSnap.docs, ...baseSnap.docs]
    .map((d) => {
      const data = d.data() as any
      const ts = data.timestamp?.toDate?.() ?? new Date(data.timestamp)
      return { rate: Number(data.rate ?? data.baseRate) || 0, ts }
    })
    .sort((a, b) => a.ts.getTime() - b.ts.getTime())

  const retainers: RetainerWindow[] = retSnap.docs.map((d) => {
    const data = d.data() as any
    return {
      start: data.retainerStarts?.toDate?.() ?? new Date(data.retainerStarts),
      end: data.retainerEnds?.toDate?.() ?? new Date(data.retainerEnds),
    }
  })

  let charges = 0
  await Promise.all(
    sessionsSnap.docs.map(async (sd) => {
      const data = sd.data() as any
      const [startDate, rateSnap, voucherSnap] = await Promise.all([
        computeSessionStart(sd.id, data),
        getDocs(collection(db, PATHS.sessionRate(sd.id))),
        getDocs(collection(db, PATHS.sessionVoucher(sd.id))),
      ])
      if (!startDate) return
      const startMs = startDate.getTime()

      const base = effectiveBaseRate(startMs, baseRates)

      let manualRate: number | null = null
      if (!rateSnap.empty) {
        const latest = rateSnap.docs
          .map((d) => d.data() as any)
          .sort((a, b) => {
            const ta = a.timestamp?.toDate?.() ?? new Date(0)
            const tb = b.timestamp?.toDate?.() ?? new Date(0)
            return tb.getTime() - ta.getTime()
          })[0]
        if (latest?.rateCharged != null) manualRate = Number(latest.rateCharged)
      }

      let rate = manualRate != null ? manualRate : base
      if (
        manualRate == null &&
        data.sessionType?.toLowerCase?.() === 'virtual'
      ) {
        rate = rate / 2
      }

      let billable = rate
      const sessionType = data.sessionType?.toLowerCase?.()
      if (sessionType === 'cancelled') billable = 0
      if (latestVoucherUsed(voucherSnap.docs)) billable = 0
      if (inRetainer(startMs, retainers)) billable = 0

      charges += billable
    }),
  )

  const credits = paymentsSnap.docs.reduce(
    (sum, d) => sum + (Number((d.data() as any).amount) || 0),
    0,
  )

  const balance = charges - credits
  return balance > 0 ? balance : 0
}
