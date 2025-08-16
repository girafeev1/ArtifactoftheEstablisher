export interface ScanLog {
  at: number
  mode: 'inc' | 'full'
  ok: boolean
  message: string
}

const KEY = 'scanLogs'

export function readScanLogs(): ScanLog[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as ScanLog[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function writeScanLog(log: ScanLog): void {
  if (typeof window === 'undefined') return
  const logs = readScanLogs()
  logs.unshift(log)
  window.localStorage.setItem(KEY, JSON.stringify(logs.slice(0, 20)))
}
