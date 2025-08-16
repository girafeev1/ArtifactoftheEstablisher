export function paymentBlinkClass(remaining: number, minRate: number | null | undefined): string | undefined {
  if (remaining > 0) {
    if (minRate != null && remaining < minRate) return 'blink-amount--error'
    return 'blink-amount--warn'
  }
  return undefined
}
