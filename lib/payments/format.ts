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

export function normalizeIdentifier(
  entity: string,
  bankCode?: string,
  accountDocId?: string,
  identifier?: string,
): string | undefined {
  if (entity !== 'Music Establish (ERL)' && entity !== 'ME-ERL') return undefined
  const built = buildIdentifier(bankCode, accountDocId)
  if (!identifier) return built
  return /^[0-9A-Za-z]+\/[0-9A-Za-z_-]+$/.test(identifier) ? identifier : built
}
