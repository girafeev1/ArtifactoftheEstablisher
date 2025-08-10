export const PATHS = {
  students: 'Students',
  sessions: 'Sessions',
  student: (abbr: string) => `Students/${abbr}`,
  payments: (abbr: string) => `Students/${abbr}/Payments`,
  baseRate: (abbr: string) => `Students/${abbr}/BaseRate`,
  baseRateHistory: (abbr: string) => `Students/${abbr}/BaseRateHistory`,
  retainers: (abbr: string) => `Students/${abbr}/Retainers`,
  sessionPayment: (sessionId: string) => `Sessions/${sessionId}/payment`,
  sessionRate: (sessionId: string) => `Sessions/${sessionId}/rateCharged`,
  sessionHistory: (sessionId: string) => `Sessions/${sessionId}/appointmentHistory`,
}
export const logPath = (label: string, path: string) =>
  console.debug(`[paths] ${label}: ${path}`)
