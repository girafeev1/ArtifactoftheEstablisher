export interface InvoiceItem {
  description: string
  amount: number
}

export interface Invoice {
  id: string
  studentAbbr: string
  account: string
  items: InvoiceItem[]
  total: number
  issuedOn: Date
  paid?: boolean
}

