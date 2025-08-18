export function buildIdentifier(
  bankCode?: string,
  accountDocId?: string,
): string | undefined {
  if (!bankCode || !accountDocId) return undefined
  const cleanBank = bankCode.replace(/[^0-9A-Za-z]/g, '')
  const cleanAccount = accountDocId.replace(/[^0-9A-Za-z_-]/g, '')
  const id = `${cleanBank}/${cleanAccount}`
  return /^[0-9A-Za-z]+\/[0-9A-Za-z_-]+$/.test(id) ? id : undefined
}
