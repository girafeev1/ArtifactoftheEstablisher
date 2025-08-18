export function truncateList<T>(arr: T[], limit = 5): { visible: T[]; hiddenCount: number } {
  const visible = arr.slice(0, limit)
  const hiddenCount = arr.length > limit ? arr.length - limit : 0
  return { visible, hiddenCount }
}
