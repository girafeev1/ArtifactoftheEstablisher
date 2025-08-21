export function readColumnPrefs(
  key: string,
  defaults: Record<string, boolean>,
): Record<string, boolean> {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return { ...defaults }
}

export function writeColumnPrefs(
  key: string,
  prefs: Record<string, boolean>,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}
