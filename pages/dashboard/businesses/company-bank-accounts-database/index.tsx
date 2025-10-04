import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

import ClientBankDatabasePage from '../../../../components/database/ClientBankDatabasePage'
import { fetchClientsDirectory, type ClientDirectoryRecord } from '../../../../lib/clientDirectory'
import { fetchBankAccountsDirectory, type BankAccountDirectoryRecord } from '../../../../lib/bankAccountsDirectory'

interface CompanyBankAccountsDatabasePageProps {
  clients: ClientDirectoryRecord[]
  bankAccounts: BankAccountDirectoryRecord[]
  error?: string
}

export default function CompanyBankAccountsDatabasePage({
  clients,
  bankAccounts,
  error,
}: CompanyBankAccountsDatabasePageProps) {
  return (
    <ClientBankDatabasePage
      clients={clients}
      bankAccounts={bankAccounts}
      error={error}
      initialView='bank'
    />
  )
}

export const getServerSideProps: GetServerSideProps<CompanyBankAccountsDatabasePageProps> = async (ctx) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin', permanent: false },
    }
  }

  let clients: ClientDirectoryRecord[] = []
  let bankAccounts: BankAccountDirectoryRecord[] = []
  const errors: string[] = []

  try {
    clients = await fetchClientsDirectory()
  } catch (err) {
    console.error('[company-bank-accounts-database] Failed to load clients:', err)
    errors.push(err instanceof Error ? err.message : 'Failed to load client directory')
  }

  try {
    bankAccounts = await fetchBankAccountsDirectory()
  } catch (err) {
    console.error('[company-bank-accounts-database] Failed to load bank accounts:', err)
    errors.push(err instanceof Error ? err.message : 'Failed to load bank accounts')
  }

  return {
    props: {
      clients,
      bankAccounts,
      error: errors.length > 0 ? errors.join(' | ') : undefined,
    },
  }
}
