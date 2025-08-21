export interface PaymentDraft {
  accountDocId?: string
  entity?: string
  bankCode?: string
  [key: string]: any
}

export function reducePaymentPayload(draft: PaymentDraft) {
  const { accountDocId, entity, bankCode, ...rest } = draft
  const payload: any = { ...rest }
  if (accountDocId) payload.identifier = accountDocId
  return payload
}
