export function buildIdentifier(bankCode?: string, accountDocId?: string): string | undefined {
  if (!bankCode || !accountDocId) return undefined
  return `${bankCode}/${accountDocId}`
}
