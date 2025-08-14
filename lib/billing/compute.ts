// lib/billing/compute.ts
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { PATHS } from '../paths'
import { monthLabelFor as sharedMonthLabelFor } from './monthLabel'

export interface SessionRow {
  id: string
  startMs: number
  date: string
  time: string
  displayRate: string
  amountDue: number
  flags: {
    cancelled: boolean
    voucherUsed: boolean
    inRetainer: boolean
    manualRate: boolean
    isVirtual: boolean
    isTrial: boolean
  }
  assignedPaymentId?: string | null
}

export interface BillingResult {
  rows: SessionRow[]
  voucherBalance: number
  unpaidRetainers: { id: string; monthLabel: string; rate: number }[]
  balanceDue: number
}

export const formatCurrencyHKD = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD', currencyDisplay: 'code' }).format(n)

interface Ctx {
  abbr: string
  account: string
  baseRates: { ts: Date; rate: number }[]
  retainers: { id: string; start: number; end: number; rate: number; paymentId?: string }[]
  payments: { id: string; amount: number; ts: number; assignedSessions?: string[]; assignedRetainers?: string[] }[]
  vouchers: { ts: number; token: number }[]
  sessions: {
    id: string
    data: any
    history: any[]
    rateDocs: any[]
    sessPayments: any[]
    sessVouchers: any[]
  }[]
}

const toDate = (v: any): Date | null => {
  if (!v) return null
  try {
    const d = v.toDate ? v.toDate() : new Date(v)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

const baseRateAt = (rates: Ctx['baseRates'], t: number) => {
  const r = rates.filter(b => b.ts.getTime() <= t).pop()
  return r ? Number(r.rate) || 0 : 0
}

const retainerFor = (rets: Ctx['retainers'], t: number) =>
  rets.find(r => t >= r.start && t <= r.end)


export async function buildContext(abbr: string, account: string): Promise<Ctx> {
  const [histSnap, baseSnap, retSnap, voucherSnap, paySnap, sessSnap] = await Promise.all([
    getDocs(collection(db, PATHS.baseRateHistory(abbr))),
    getDocs(collection(db, PATHS.baseRate(abbr))),
    getDocs(collection(db, PATHS.retainers(abbr))),
    getDocs(collection(db, PATHS.freeMeal(abbr))),
    getDocs(collection(db, PATHS.payments(abbr))),
    getDocs(query(collection(db, PATHS.sessions), where('sessionName', '==', account))),
  ])

  const baseRates = [...histSnap.docs, ...baseSnap.docs]
    .map(d => ({ ts: toDate((d.data() as any).timestamp) || new Date(0), rate: Number((d.data() as any).rate ?? (d.data() as any).baseRate) || 0 }))
    .sort((a, b) => a.ts.getTime() - b.ts.getTime())

  const retainers = retSnap.docs.map(d => {
    const r = d.data() as any
    const start = toDate(r.retainerStarts)?.getTime() ?? (new Date(r.retainerStarts).getTime() || 0)
    const end = toDate(r.retainerEnds)?.getTime() ?? (new Date(r.retainerEnds).getTime() || 0)
    return { id: d.id, start, end, rate: Number(r.retainerRate) || 0, paymentId: r.paymentId }
  })

  const payments = paySnap.docs.map(d => {
    const p = d.data() as any
    const ts = toDate(p.paymentMade)?.getTime() ?? (new Date(p.paymentMade).getTime() || 0)
    return { id: d.id, amount: Number(p.amount) || 0, ts, assignedSessions: p.assignedSessions || [], assignedRetainers: p.assignedRetainers || [] }
  })

  const vouchers = voucherSnap.docs
    .map(d => {
      const v = d.data() as any
      const eff = toDate(v.effectiveDate)?.getTime() ?? new Date(v.effectiveDate).getTime()
      const ts = !isNaN(eff) ? eff : (toDate(v.timestamp)?.getTime() ?? (new Date(v.timestamp).getTime() || 0))
      return { ts, token: Number(v.Token) || 0 }
    })
    .sort((a, b) => a.ts - b.ts)

  const sessions = await Promise.all(sessSnap.docs.map(async sd => {
    const [hist, rate, pay, vo] = await Promise.all([
      getDocs(collection(db, PATHS.sessionHistory(sd.id))),
      getDocs(collection(db, PATHS.sessionRate(sd.id))),
      getDocs(collection(db, PATHS.sessionPayment(sd.id))),
      getDocs(collection(db, PATHS.sessionVoucher(sd.id))),
    ])
    return {
      id: sd.id,
      data: sd.data(),
      history: hist.docs.map(d => d.data()),
      rateDocs: rate.docs.map(d => d.data()),
      sessPayments: pay.docs.map(d => d.data()),
      sessVouchers: vo.docs.map(d => d.data()),
    }
  }))

  return { abbr, account, baseRates, retainers, payments, vouchers, sessions }
}

export function computeBilling(ctx: Ctx): BillingResult {
  const assignedSessionIds = new Set<string>()
  const assignedRetTokens = new Set<string>()
  ctx.payments.forEach(p => {
    (p.assignedSessions || []).forEach(s => assignedSessionIds.add(String(s)))
    ;(p.assignedRetainers || []).forEach(r => assignedRetTokens.add(String(r)))
  })

  const rows: SessionRow[] = ctx.sessions.map(s => {
    const hist = s.history.sort((a,b)=> (toDate(b.changeTimestamp)?.getTime() ?? 0) - (toDate(a.changeTimestamp)?.getTime() ?? 0))[0] || {}
    const startRaw = hist.newStartTimestamp ?? hist.origStartTimestamp ?? s.data?.origStartTimestamp ?? s.data?.sessionDate ?? s.data?.startTimestamp
    const endRaw = hist.newEndTimestamp ?? hist.origEndTimestamp ?? s.data?.origEndTimestamp ?? s.data?.endTimestamp
    const sd = toDate(startRaw)
    const ed = toDate(endRaw)
    const startMs = sd?.getTime() || 0
    const date = sd ? sd.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}) : '-'
    const time = sd && ed ? `${sd.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}-${ed.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}` : (sd ? sd.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '-')
    const type = (s.data?.sessionType || '').toLowerCase()
    const isVirtual = type === 'virtual'
    const cancelled = type === 'cancelled'
    const manualRate = !!(s.rateDocs.sort((a,b)=> (toDate(b.timestamp)?.getTime()??0)-(toDate(a.timestamp)?.getTime()??0))[0]?.rateCharged)
    const hasSessPayment = s.sessPayments.length > 0
    const assignedPaymentId = hasSessPayment || assignedSessionIds.has(s.id) ? 'assigned' : null
    const voucherUsed = s.sessVouchers
      .map(v=>({ ts: toDate(v.timestamp)?.getTime() ?? 0, free:v['free?']===true }))
      .sort((a,b)=>a.ts-b.ts).pop()?.free || false
    const inRetainer = !!retainerFor(ctx.retainers,startMs)
    return { id:s.id,startMs,date,time,displayRate:'-',amountDue:0,flags:{cancelled,voucherUsed,inRetainer,manualRate,isVirtual,isTrial:false},assignedPaymentId }
  }).sort((a,b)=>a.startMs-b.startMs)

  const idx = rows.findIndex(r=>!r.flags.cancelled && !r.flags.voucherUsed && !r.flags.inRetainer)
  if (idx>=0) rows[idx].flags.isTrial=true

  rows.forEach(r=>{
    if(r.flags.cancelled||r.flags.voucherUsed) return
    if(r.flags.inRetainer){
      const ret = retainerFor(ctx.retainers,r.startMs)!
      r.displayRate = `${sharedMonthLabelFor(ret.start)} | ${formatCurrencyHKD(ret.rate)}`
      return
    }
    if(r.flags.isTrial && !r.flags.manualRate){
      r.amountDue=500
      r.displayRate=formatCurrencyHKD(500)
      return
    }
  })

  rows.forEach(r=>{
    if(r.flags.cancelled||r.flags.voucherUsed||r.flags.inRetainer||r.amountDue>0) return
    const base = baseRateAt(ctx.baseRates,r.startMs)
    const sess = ctx.sessions.find(s=>s.id===r.id)!
    if(r.flags.manualRate){
      const man = sess.rateDocs.sort((a,b)=> (toDate(b.timestamp)?.getTime()??0)-(toDate(a.timestamp)?.getTime()??0))[0]?.rateCharged
      const val = Number(man)||0
      r.amountDue=val
      r.displayRate=formatCurrencyHKD(val)
    }else if(r.flags.isVirtual){
      const val = base/2
      r.amountDue=val
      r.displayRate=formatCurrencyHKD(val)
    }else if(!r.flags.isTrial){
      r.amountDue=base
      r.displayRate=formatCurrencyHKD(base)
    }
  })

  let running=0, vi=0
  rows.forEach(r=>{
    while(vi<ctx.vouchers.length && ctx.vouchers[vi].ts<=r.startMs){ running+=ctx.vouchers[vi].token; vi++ }
    if(r.flags.voucherUsed) running-=1
  })
  const now=Date.now()
  while(vi<ctx.vouchers.length && ctx.vouchers[vi].ts<=now){ running+=ctx.vouchers[vi].token; vi++ }
  const voucherBalance=running

  const isRetPaid = (ret:{id:string;start:number;paymentId?:string})=>{
    if(ret.paymentId) return true
    const label = sharedMonthLabelFor(ret.start)
    return assignedRetTokens.has(ret.id)||assignedRetTokens.has(`retainer:${ret.id}`)||assignedRetTokens.has(label)||assignedRetTokens.has(`retainer:${label}`)
  }
  const unpaidRetainers = ctx.retainers
    .filter(r => !isRetPaid(r))
    .map(r => ({ id: r.id, monthLabel: sharedMonthLabelFor(r.start), rate: r.rate }))

  const unpaidSessions = rows.filter(r=>!r.flags.cancelled&&!r.flags.voucherUsed&&!r.flags.inRetainer&&!r.assignedPaymentId)
  const balanceDue = unpaidSessions.reduce((s,r)=>s+(Number(r.amountDue)||0),0)+unpaidRetainers.reduce((s,r)=>s+r.rate,0)

  return { rows, voucherBalance, unpaidRetainers, balanceDue }
}
