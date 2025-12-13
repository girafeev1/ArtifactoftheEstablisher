// lib/bankAccountsDirectory.ts

export interface BankAccountDirectoryRecord {
  bankName: string
  bankCode: string | null
  accountId: string
  accountType: string | null
  accountNumber: string | null
  status: boolean | null
  fpsId: string | null
  fpsEmail: string | null
}
