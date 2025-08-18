export function paymentIdentifier(
  entity: string,
  bankCode?: string,
  accountId?: string,
): string | undefined {
  if (entity !== 'ME-ERL') return undefined
  if (!bankCode || !accountId) return undefined
  return `${bankCode}/${accountId}`
}
