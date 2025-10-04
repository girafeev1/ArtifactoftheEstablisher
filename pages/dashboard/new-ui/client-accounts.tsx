import Head from 'next/head'
import dynamic from 'next/dynamic'
import { memo } from 'react'
import {
  Refine,
  useList,
  type DataProvider,
  type BaseRecord,
  type GetListResponse,
} from '@refinedev/core'
import routerProvider from '@refinedev/nextjs-router'
import {
  Box,
  Card,
  CardContent,
  CssBaseline,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material'
import type { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

import type { ClientDirectoryRecord } from '../../../lib/clientDirectory'

const refineDataProvider: DataProvider = {
  getApiUrl: () => '/api',
  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, sorters }) => {
    if (resource !== 'client-directory') {
      return { data: [], total: 0 }
    }

    const response = await fetch('/api/client-directory', { credentials: 'include' })
    if (!response.ok) {
      throw new Error('Failed to load client directory')
    }

    const payload = await response.json()
    const items: Array<ClientDirectoryRecord & { id: string }> = payload.data ?? []
    const total = typeof payload.total === 'number' ? payload.total : items.length

    const current = typeof pagination?.current === 'number' ? pagination.current : 1
    const pageSize = typeof pagination?.pageSize === 'number' ? pagination.pageSize : total
    const start = (current - 1) * pageSize
    const end = start + pageSize

    let sorted = items
    if (sorters && sorters.length > 0) {
      const [{ field, order }] = sorters
      sorted = [...items].sort((a: any, b: any) => {
        const aValue = a[field as keyof typeof a]
        const bValue = b[field as keyof typeof b]
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return order === 'asc' ? -1 : 1
        if (bValue == null) return order === 'asc' ? 1 : -1
        if (aValue < bValue) return order === 'asc' ? -1 : 1
        if (aValue > bValue) return order === 'asc' ? 1 : -1
        return 0
      })
    }

    const page = sorted.slice(start, end)

    return {
      data: page as unknown as TData[],
      total,
    } as GetListResponse<TData>
  },
  getOne: () => Promise.reject(new Error('Not implemented')),
  getMany: () => Promise.reject(new Error('Not implemented')),
  create: () => Promise.reject(new Error('Not implemented')),
  update: () => Promise.reject(new Error('Not implemented')),
  deleteOne: () => Promise.reject(new Error('Not implemented')),
  deleteMany: () => Promise.reject(new Error('Not implemented')),
  updateMany: () => Promise.reject(new Error('Not implemented')),
  createMany: () => Promise.reject(new Error('Not implemented')),
}

const ClientAccountsTable = memo(() => {
  const { query, result } = useList<ClientDirectoryRecord & { id: string }>({
    resource: 'client-directory',
    pagination: {
      pageSize: 25,
    },
    sorters: [{ field: 'companyName', order: 'asc' }],
  })

  if (query.isLoading) {
    return <LinearProgress sx={{ width: '100%' }} />
  }

  const rows = result.data ?? []

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Company</TableCell>
          <TableCell>Title</TableCell>
          <TableCell>Contact</TableCell>
          <TableCell>Email</TableCell>
          <TableCell>Phone</TableCell>
          <TableCell>Region</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} hover>
            <TableCell>{row.companyName}</TableCell>
            <TableCell>{row.title ?? '—'}</TableCell>
            <TableCell>{row.nameAddressed ?? row.name ?? '—'}</TableCell>
            <TableCell>{row.emailAddress ?? '—'}</TableCell>
            <TableCell>{row.phone ?? '—'}</TableCell>
            <TableCell>{row.region ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
})

ClientAccountsTable.displayName = 'ClientAccountsTable'

const theme = createTheme({ palette: { mode: 'light' } })

const ClientAccountsShell = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Refine
      dataProvider={refineDataProvider}
      routerProvider={routerProvider}
      resources={[{ name: 'client-directory' }]}
      options={{ syncWithLocation: false }}
    >
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Client Accounts
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          This preview uses Refine’s data hooks and MUI components to render your Firestore-backed directory. The
          table below mirrors the legacy layout while adopting Refine patterns for future CRUD flows.
        </Typography>
        <Card>
          <CardContent>
            <ClientAccountsTable />
          </CardContent>
        </Card>
      </Box>
    </Refine>
  </ThemeProvider>
)

const ClientAccountsNoSSR = dynamic(() => Promise.resolve(ClientAccountsShell), { ssr: false })

export default function ClientAccountsPage() {
  return (
    <>
      <Head>
        <title>Client Accounts · Refine Preview</title>
      </Head>
      <ClientAccountsNoSSR />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    }
  }

  return { props: {} }
}
