import Head from "next/head"
import Link from "next/link"
import dynamic from "next/dynamic"
import { memo, useMemo, useState } from "react"
import {
  Refine,
  useList,
  useMenu,
  type DataProvider,
  type BaseRecord,
  type GetListResponse,
} from "@refinedev/core"
import routerProvider from "@refinedev/nextjs-router"
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CssBaseline,
  Grid,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  createTheme,
} from "@mui/material"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded"
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded"
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

const ClientAccountsGallery = memo(({ viewMode }: { viewMode: "cards" | "list" }) => {
  const { query, result } = useList<ClientDirectoryRecord & { id: string }>({
    resource: "client-directory",
    pagination: {
      pageSize: 25,
    },
    sorters: [{ field: "companyName", order: "asc" }],
  })

  const [search, setSearch] = useState("")

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

  const renderCards = () => (
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
  )

  const renderList = () => (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Company</TableCell>
          <TableCell>Contact</TableCell>
          <TableCell>Email</TableCell>
          <TableCell>Phone</TableCell>
          <TableCell>Region</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filtered.map((row) => (
          <TableRow key={row.id} hover>
            <TableCell sx={{ fontWeight: 600 }}>{row.companyName}</TableCell>
            <TableCell>{row.nameAddressed ?? row.name ?? "—"}</TableCell>
            <TableCell>{row.emailAddress ?? "—"}</TableCell>
            <TableCell>{row.phone ?? "—"}</TableCell>
            <TableCell>
              <Chip label={row.region ?? "Region unknown"} size="small" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

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

      {query.isLoading ? (
        <LinearProgress sx={{ width: "100%" }} />
      ) : viewMode === "cards" ? (
        renderCards()
      ) : (
        renderList()
      )}
    </Stack>
  )
})

ClientAccountsGallery.displayName = "ClientAccountsGallery"

const theme = createTheme({ palette: { mode: "light" } })

const SidebarNavigation = memo(() => {
  const { menuItems, selectedKey } = useMenu()

  const renderItems = (items: typeof menuItems, depth = 0) =>
    items.map((item) => {
      const label = item.label ?? item.name
      const listPath = typeof item.list === "string" ? item.list : undefined
      const href = item.route ?? listPath ?? "#"
      const selected = item.key === selectedKey

      return (
        <Box key={item.key} sx={{ width: "100%" }}>
          <Link href={href} prefetch={false} style={{ textDecoration: "none" }}>
            <Box
              sx={{
                display: "block",
                px: 3,
                py: 1,
                ml: depth * 1.5,
                borderRadius: 2,
                fontWeight: selected ? 600 : 400,
                color: selected ? "primary.main" : "text.primary",
                bgcolor: selected ? "primary.light" : "transparent",
                transition: "background-color 150ms ease",
                "&:hover": {
                  bgcolor: selected ? "primary.light" : "action.hover",
                },
              }}
            >
              {label}
            </Box>
          </Link>

          {item.children && item.children.length > 0 && (
            <Stack component="div" spacing={0.5} sx={{ mt: 0.5 }}>
              {renderItems(item.children, depth + 1)}
            </Stack>
          )}
        </Box>
      )
    })

  return (
    <Box
      component="nav"
      sx={{
        width: 260,
        flexShrink: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        py: 4,
      }}
    >
      <Typography variant="h6" sx={{ px: 3, fontWeight: 700 }}>
        Refine CRM
      </Typography>
      <Stack component="div" spacing={0.5} sx={{ px: 1 }}>
        {renderItems(menuItems)}
      </Stack>
    </Box>
  )
})

SidebarNavigation.displayName = "SidebarNavigation"

const ClientAccountsShell = () => {
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards")

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Refine
        dataProvider={refineDataProvider}
        routerProvider={routerProvider}
        resources={[
          { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
          {
            name: "client-directory",
            list: "/dashboard/new-ui/client-accounts",
            meta: { label: "Client Accounts" },
          },
          { name: "projects", list: "/dashboard/projects", meta: { label: "Projects" } },
        ]}
        options={{ syncWithLocation: false }}
      >
        <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
          <SidebarNavigation />

          <Box component="main" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box
              component="header"
              sx={{
                px: 4,
                py: 2.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="h5" fontWeight={600}>
                  Client Accounts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Review your latest client relationships and contact information.
                </Typography>
              </Box>

              <Stack direction="row" spacing={2} alignItems="center">
                <ToggleButtonGroup
                  size="small"
                  value={viewMode}
                  exclusive
                  onChange={(_event, next) => {
                    if (next) {
                      setViewMode(next)
                    }
                  }}
                >
                  <ToggleButton value="cards" aria-label="Card view">
                    <ViewModuleRoundedIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="list" aria-label="List view">
                    <ViewListRoundedIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>

                <Button variant="contained" color="primary">
                  Add new client
                </Button>

                <Avatar sx={{ bgcolor: "secondary.light", color: "secondary.dark" }}>AL</Avatar>
              </Stack>
            </Box>

            <Box sx={{ p: 4, flex: 1 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <ClientAccountsGallery viewMode={viewMode} />
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Refine>
    </ThemeProvider>
  )
}

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
  if (!session?.user) {
    return {
      redirect: {
        destination: "/api/auth/signin",
        permanent: false,
      },
    }
  }

  return { props: {} }
}
