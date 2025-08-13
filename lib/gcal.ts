export async function scanGoogleCalendar() {
  const res = await fetch('/api/gcal/scan')
  if (!res.ok) throw new Error('scan failed')
  return res.json() as Promise<{ added?: number; updated?: number; skipped?: number }>
}

export function startGCalAutoLogging() {
  // Auto logging should be handled by a Cloud Function or external scheduler
  // that periodically hits the /api/gcal/scan endpoint.
}

