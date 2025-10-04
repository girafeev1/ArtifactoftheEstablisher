import Head from "next/head"
import dynamic from "next/dynamic"
import { memo, useMemo, useState } from "react"
import {
  Refine,
  useList,
  type DataProvider,
  type BaseRecord,
  type GetListResponse,
} from "@refinedev/core"
import routerProvider from "@refinedev/nextjs-router"
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CssBaseline,
  Grid,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import type { GetServerSideProps } from "next"
import { getSession } from "next-auth/react"

import type { ClientDirectoryRecord } from "../../../lib/clientDirectory"

const refineDataProvider: DataProvider = {
  getApiUrl: () => "/api",
  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, sorters }) => {
    if (resource !== "client-directory") {
      return { data: [], total: 0 }
    }

    const response = await fetch("/api/client-directory", { credentials: "include" })
    if (!response.ok) {
      throw new Error("Failed to load client directory")
    }

    const payload = await response.json()
    const items: Array<ClientDirectoryRecord & { id: string }> = payload.data ?? []
    const total = typeof payload.total === "number" ? payload.total : items.length

    const current = typeof pagination?.current === "number" ? pagination.current : 1
    const pageSize = typeof pagination?.pageSize === "number" ? pagination.pageSize : total
    const start = (current - 1) * pageSize
    const end = start + pageSize

    let sorted = items
    if (sorters && sorters.length > 0) {
      const [{ field, order }] = sorters
      sorted = [...items].sort((a: any, b: any) => {
        const aValue = a[field as keyof typeof a]
        const bValue = b[field as keyof typeof b]
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return order === "asc" ? -1 : 1
        if (bValue == null) return order === "asc" ? 1 : -1
        if (aValue < bValue) return order === "asc" ? -1 : 1
        if (aValue > bValue) return order === "asc" ? 1 : -1
        return 0
      })
    }

    const page = sorted.slice(start, end)

    return {
      data: page as unknown as TData[],
      total,
    } as GetListResponse<TData>
  },
  getOne: () => Promise.reject(new Error("Not implemented")),
  getMany: () => Promise.reject(new Error("Not implemented")),
  create: () => Promise.reject(new Error("Not implemented")),
  update: () => Promise.reject(new Error("Not implemented")),
  deleteOne: () => Promise.reject(new Error("Not implemented")),
  deleteMany: () => Promise.reject(new Error("Not implemented")),
  updateMany: () => Promise.reject(new Error("Not implemented")),
  createMany: () => Promise.reject(new Error("Not implemented")),
}

const ClientAccountsGallery = memo(() => {
  const { query, result } = useList<ClientDirectoryRecord & { id: string }>({
    resource: "client-directory",
    pagination: {
      pageSize: 25,
    },
    sorters: [{ field: "companyName", order: "asc" }],
  })

  const [search, setSearch] = useState("")

  if (query.isLoading) {
    return <LinearProgress sx={{ width: "100%" }} />
  }

  const rows = result.data ?? []

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) {
      return rows
    }

    return rows.filter((row) => {
      const haystack = [
        row.companyName,
        row.nameAddressed,
        row.name,
        row.emailAddress,
        row.phone,
        row.region,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [rows, search])

  return (
    <Stack spacing={3}>
      <TextField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search clients"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      <Grid container spacing={2}>
        {filtered.map((row) => (
          <Grid item key={row.id} xs={12} sm={6} lg={4}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: "primary.light", color: "primary.dark" }}>
                    {row.companyName.slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {row.companyName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {row.title ?? "—"}
                    </Typography>
                  </Box>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Contact
                  </Typography>
                  <Typography variant="body1">
                    {row.nameAddressed ?? row.name ?? "—"}
                  </Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">{row.emailAddress ?? "—"}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography variant="body1">{row.phone ?? "—"}</Typography>
                </Stack>

                <Box>
                  <Chip label={row.region ?? "Region unknown"} size="small" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  )
})

ClientAccountsGallery.displayName = "ClientAccountsGallery"

const theme = createTheme({ palette: { mode: "light" } })

const ClientAccountsShell = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Refine
      dataProvider={refineDataProvider}
      routerProvider={routerProvider}
      resources={[{ name: "client-directory" }]}
      options={{ syncWithLocation: false }}
    >
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Client Accounts
        </Typography>
        <Card>
          <CardContent>
            <ClientAccountsGallery />
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
        destination: "/api/auth/signin",
        permanent: false,
      },
    }
  }

  return { props: {} }
}
