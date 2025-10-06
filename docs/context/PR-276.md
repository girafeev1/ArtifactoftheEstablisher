# PR #276 — Diff Summary

- **Base (target)**: `332da4bfa690be735d61edd798182f78d1fddcf8`
- **Head (source)**: `9bab2546d0d5bee3029ec43dd63e56f51130d128`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
A	__tests__/pages/auth/signin.test.tsx
A	__tests__/pages/dashboard/new-ui/client-accounts.test.tsx
A	components/client-accounts/NewUIClientAccountsApp.tsx
A	docs/client-accounts-runtime.md
M	lib/clientDirectory.ts
M	lib/firebase.ts
M	next.config.ts
M	package-lock.json
M	package.json
M	pages/_app.tsx
A	pages/api/auth/nextauth-credentials-diagnostics.ts
M	pages/api/client-directory/index.ts
M	pages/auth/signin.tsx
M	pages/dashboard/new-ui/client-accounts.tsx
A	scripts/replaceImportMetaLoader.js
A	styles/antd-reset.css
A	types/refinedev.d.ts
```

## Stats

```txt
 __tests__/pages/auth/signin.test.tsx               |  197 ++
 .../dashboard/new-ui/client-accounts.test.tsx      |   97 +
 .../client-accounts/NewUIClientAccountsApp.tsx     | 1468 +++++++++++++
 docs/client-accounts-runtime.md                    |   12 +
 lib/clientDirectory.ts                             |  151 +-
 lib/firebase.ts                                    |  134 +-
 next.config.ts                                     |   45 +-
 package-lock.json                                  | 2226 +++++++++++++++++++-
 package.json                                       |    5 +
 pages/_app.tsx                                     |    1 +
 pages/api/auth/nextauth-credentials-diagnostics.ts |  110 +
 pages/api/client-directory/index.ts                |   12 +-
 pages/auth/signin.tsx                              |  143 +-
 pages/dashboard/new-ui/client-accounts.tsx         |  270 +--
 scripts/replaceImportMetaLoader.js                 |   13 +
 styles/antd-reset.css                              |  257 +++
 types/refinedev.d.ts                               |   11 +
 17 files changed, 4760 insertions(+), 392 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/__tests__/pages/auth/signin.test.tsx b/__tests__/pages/auth/signin.test.tsx
new file mode 100644
index 0000000..b5e0e06
--- /dev/null
+++ b/__tests__/pages/auth/signin.test.tsx
@@ -0,0 +1,197 @@
+/** @jest-environment jsdom */
+
+import '@testing-library/jest-dom'
+import { fireEvent, render, screen, waitFor } from '@testing-library/react'
+
+jest.mock('next/router', () => ({
+  useRouter: () => ({
+    replace: jest.fn(),
+  }),
+}))
+
+const mockSignIn = jest.fn()
+
+jest.mock('next-auth/react', () => ({
+  signIn: (...args: unknown[]) => mockSignIn(...args),
+  useSession: () => ({ status: 'unauthenticated' }),
+}))
+
+const mockCredentialFromResult = jest.fn()
+const mockSignInWithPopup = jest.fn()
+
+jest.mock('firebase/auth', () => ({
+  GoogleAuthProvider: Object.assign(
+    function GoogleAuthProvider(this: any) {
+      this.addScope = jest.fn()
+      this.setCustomParameters = jest.fn()
+    },
+    {
+      credentialFromResult: (...args: unknown[]) => mockCredentialFromResult(...args),
+    }
+  ),
+  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
+  signInWithEmailAndPassword: jest.fn(),
+  createUserWithEmailAndPassword: jest.fn(),
+}))
+
+jest.mock('../../../lib/firebaseClientAuth', () => ({
+  auth: {},
+}))
+
+describe('SignInPage Google diagnostics', () => {
+  let consoleErrorSpy: jest.SpyInstance
+
+  beforeEach(() => {
+    mockSignIn.mockReset()
+    mockSignInWithPopup.mockReset()
+    mockCredentialFromResult.mockReset()
+    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
+  })
+
+  afterEach(() => {
+    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
+    delete (global as Record<string, unknown>).fetch
+    consoleErrorSpy.mockRestore()
+  })
+
+  it('surfaces NextAuth diagnostics failures ahead of other messaging', async () => {
+    mockSignInWithPopup.mockResolvedValue({
+      user: {
+        getIdToken: jest.fn().mockResolvedValue('id-token'),
+        refreshToken: 'refresh-token',
+      },
+    })
+
+    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })
+
+    mockSignIn.mockResolvedValue({
+      error: 'CredentialsSignin',
+      ok: false,
+      status: 401,
+    })
+
+    const nextAuthDiagnosticsMessage = 'NextAuth authorize exploded'
+
+    global.fetch = jest
+      .fn()
+      .mockImplementation((input: RequestInfo | URL) => {
+        const url = typeof input === 'string' ? input : input.toString()
+
+        if (url.includes('nextauth-credentials-diagnostics')) {
+          return Promise.resolve({
+            ok: true,
+            json: async () => ({ ok: false, message: nextAuthDiagnosticsMessage, name: 'AuthorizeError' }),
+          })
+        }
+
+        if (url.includes('firebase-diagnostics')) {
+          return Promise.resolve({
+            ok: true,
+            json: async () => ({ ok: true, uid: 'uid', projectId: 'project' }),
+          })
+        }
+
+        throw new Error(`Unexpected fetch call to ${url}`)
+      }) as unknown as typeof fetch
+
+    const { default: SignInPage } = await import('../../../pages/auth/signin')
+
+    render(<SignInPage />)
+
+    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
+
+    await waitFor(() => {
+      expect(screen.getByRole('alert')).toHaveTextContent(nextAuthDiagnosticsMessage)
+    })
+  })
+
+  it('combines diagnostics when both Firebase and NextAuth accept the credentials', async () => {
+    mockSignInWithPopup.mockResolvedValue({
+      user: {
+        getIdToken: jest.fn().mockResolvedValue('id-token'),
+        refreshToken: 'refresh-token',
+      },
+    })
+
+    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })
+
+    mockSignIn.mockResolvedValue({
+      error: 'CredentialsSignin',
+      ok: false,
+      status: 401,
+    })
+
+    global.fetch = jest
+      .fn()
+      .mockImplementation((input: RequestInfo | URL) => {
+        const url = typeof input === 'string' ? input : input.toString()
+
+        if (url.includes('nextauth-credentials-diagnostics')) {
+          return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
+        }
+
+        if (url.includes('firebase-diagnostics')) {
+          return Promise.resolve({ ok: true, json: async () => ({ ok: true, uid: 'uid', projectId: 'project' }) })
+        }
+
+        throw new Error(`Unexpected fetch call to ${url}`)
+      }) as unknown as typeof fetch
+
+    const { default: SignInPage } = await import('../../../pages/auth/signin')
+
+    render(<SignInPage />)
+
+    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
+
+    await waitFor(() => {
+      expect(screen.getByRole('alert')).toHaveTextContent(
+        'NextAuth authorize() and Firebase Admin both accepted the credentials when retried directly, but the sign-in endpoint still responded with "CredentialsSignin". Check the server logs for callback or session errors.'
+      )
+    })
+  })
+
+  it('falls back to NextAuth error when diagnostics return nothing', async () => {
+    mockSignInWithPopup.mockResolvedValue({
+      user: {
+        getIdToken: jest.fn().mockResolvedValue('id-token'),
+        refreshToken: 'refresh-token',
+      },
+    })
+
+    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })
+
+    const nextAuthError = 'Server rejected credentials'
+
+    mockSignIn.mockResolvedValue({
+      error: nextAuthError,
+      ok: false,
+      status: 401,
+    })
+
+    global.fetch = jest
+      .fn()
+      .mockImplementation((input: RequestInfo | URL) => {
+        const url = typeof input === 'string' ? input : input.toString()
+
+        if (url.includes('nextauth-credentials-diagnostics')) {
+          return Promise.resolve({ ok: false })
+        }
+
+        if (url.includes('firebase-diagnostics')) {
+          return Promise.resolve({ ok: false })
+        }
+
+        throw new Error(`Unexpected fetch call to ${url}`)
+      }) as unknown as typeof fetch
+
+    const { default: SignInPage } = await import('../../../pages/auth/signin')
+
+    render(<SignInPage />)
+
+    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
+
+    await waitFor(() => {
+      expect(screen.getByRole('alert')).toHaveTextContent(nextAuthError)
+    })
+  })
+})
diff --git a/__tests__/pages/dashboard/new-ui/client-accounts.test.tsx b/__tests__/pages/dashboard/new-ui/client-accounts.test.tsx
new file mode 100644
index 0000000..4b8f89e
--- /dev/null
+++ b/__tests__/pages/dashboard/new-ui/client-accounts.test.tsx
@@ -0,0 +1,97 @@
+import type { GetServerSidePropsContext } from 'next'
+import { getSession } from 'next-auth/react'
+
+import { getServerSideProps } from '../../../../pages/dashboard/new-ui/client-accounts'
+
+jest.mock('@refinedev/antd', () => ({
+  List: () => null,
+  FilterDropdown: () => null,
+  useTable: () => ({
+    tableProps: {},
+    sorters: [],
+    filters: [],
+    setFilters: jest.fn(),
+    setSorters: jest.fn(),
+  }),
+}), { virtual: true })
+
+jest.mock('@refinedev/core', () => ({
+  Refine: ({ children }: any) => children,
+  useMenu: () => ({ menuItems: [], selectedKey: undefined }),
+}))
+
+jest.mock('@refinedev/nextjs-router', () => ({}))
+
+jest.mock('antd', () => ({
+  App: ({ children }: any) => children,
+  Avatar: () => null,
+  Badge: () => null,
+  Button: () => null,
+  ConfigProvider: ({ children }: any) => children,
+  Divider: () => null,
+  Drawer: () => null,
+  Form: Object.assign(() => null, {
+    Item: () => null,
+    useForm: () => [{}, { resetFields: jest.fn(), setFieldsValue: jest.fn() }],
+  }),
+  Grid: { useBreakpoint: () => ({}) },
+  Input: Object.assign(() => null, { Search: () => null }),
+  Layout: {
+    Header: ({ children }: any) => children,
+    Content: ({ children }: any) => children,
+    Sider: ({ children }: any) => children,
+  },
+  Menu: Object.assign(() => null, { Item: () => null }),
+  Modal: ({ children }: any) => children,
+  Pagination: () => null,
+  Radio: Object.assign(() => null, {
+    Group: ({ children }: any) => children,
+    Button: ({ children }: any) => children,
+  }),
+  Select: () => null,
+  Space: ({ children }: any) => children,
+  Spin: () => null,
+  Table: () => null,
+  Tag: () => null,
+  Tooltip: ({ children }: any) => children,
+  Typography: { Text: ({ children }: any) => children, Title: ({ children }: any) => children },
+}), { virtual: true })
+
+jest.mock('@ant-design/icons', () => new Proxy({}, { get: () => () => null }), { virtual: true })
+
+jest.mock('lodash.debounce', () => (fn: any) => fn, { virtual: true })
+
+jest.mock('next-auth/react', () => ({
+  getSession: jest.fn(),
+}))
+
+describe('Client Accounts (Refine preview) getServerSideProps', () => {
+  const mockContext = {} as GetServerSidePropsContext
+  const getSessionMock = getSession as jest.Mock
+
+  beforeEach(() => {
+    getSessionMock.mockReset()
+  })
+
+  it('redirects to sign-in when no authenticated user is present', async () => {
+    getSessionMock.mockResolvedValue(null)
+
+    const result = await getServerSideProps(mockContext)
+
+    expect(result).toEqual({
+      redirect: { destination: '/api/auth/signin', permanent: false },
+    })
+    expect(getSessionMock).toHaveBeenCalledWith(mockContext)
+  })
+
+  it('allows access when the session only includes user information', async () => {
+    getSessionMock.mockResolvedValue({
+      user: { name: 'Ada Lovelace', email: 'ada@example.com' },
+    })
+
+    const result = await getServerSideProps(mockContext)
+
+    expect(result).toEqual({ props: {} })
+    expect(getSessionMock).toHaveBeenCalledWith(mockContext)
+  })
+})
diff --git a/components/client-accounts/NewUIClientAccountsApp.tsx b/components/client-accounts/NewUIClientAccountsApp.tsx
new file mode 100644
index 0000000..d3c1a3c
--- /dev/null
+++ b/components/client-accounts/NewUIClientAccountsApp.tsx
@@ -0,0 +1,1468 @@
+import { useEffect, useMemo, useState, type ReactNode } from "react"
+import {
+  Refine,
+  useMenu,
+  type BaseRecord,
+  type CrudFilters,
+  type CrudSorting,
+  type DataProvider,
+  type GetListResponse,
+  type HttpError,
+} from "@refinedev/core"
+import { List, FilterDropdown, useTable } from "@refinedev/antd"
+import routerProvider from "@refinedev/nextjs-router"
+import {
+  App as AntdApp,
+  Avatar,
+  Badge,
+  Button,
+  ConfigProvider,
+  Divider,
+  Drawer,
+  Form,
+  Grid,
+  Input,
+  Layout,
+  Menu,
+  Modal,
+  Pagination,
+  Radio,
+  Select,
+  Space,
+  Spin,
+  Table,
+  Tag,
+  Tooltip,
+  Typography,
+} from "antd"
+import {
+  ApartmentOutlined,
+  AppstoreOutlined,
+  BarsOutlined,
+  BellOutlined,
+  CalendarOutlined,
+  CheckCircleOutlined,
+  CloseCircleOutlined,
+  EyeOutlined,
+  MailOutlined,
+  MenuFoldOutlined,
+  MenuUnfoldOutlined,
+  PhoneOutlined,
+  PlusCircleOutlined,
+  SearchOutlined,
+  SettingOutlined,
+  TeamOutlined,
+  ThunderboltFilled,
+  UnorderedListOutlined,
+} from "@ant-design/icons"
+import debounce from "lodash.debounce"
+import type { ClientDirectoryRecord } from "../../lib/clientDirectory"
+
+type DirectoryApiRecord = ClientDirectoryRecord & { id: string }
+
+const { Header, Content, Sider } = Layout
+const { Text } = Typography
+
+if (typeof window === "undefined") {
+  console.info("[client-accounts] Module loaded", {
+    timestamp: new Date().toISOString(),
+  })
+}
+
+type ClientAccountRow = {
+  id: string
+  displayName: string
+  baseName: string | null
+  honorific: string | null
+  email: string | null
+  phone: string | null
+  addressLine1: string | null
+  addressLine2: string | null
+  addressLine3: string | null
+  addressLine4: string | null
+  region: string | null
+  company: { id: string; name: string }
+  hasOverduePayment: boolean
+  avatarSeed: string
+  createdAt: string | null
+  source: DirectoryApiRecord
+}
+
+type ClientFilter = CrudFilters[number]
+
+type ViewMode = "table" | "card"
+
+type ActionHandlers = {
+  onViewDetails: (record: ClientAccountRow) => void
+  onSendEmail: (record: ClientAccountRow) => void
+  onCall: (record: ClientAccountRow) => void
+}
+
+type ClientDetailsFormValues = {
+  companyName: string
+  title?: string | null
+  nameAddressed?: string | null
+  emailAddress?: string | null
+  phone?: string | null
+  addressLine1?: string | null
+  addressLine2?: string | null
+  addressLine3?: string | null
+  addressLine4?: string | null
+  region?: string | null
+}
+
+type AddClientFormValues = Required<
+  Pick<ClientDetailsFormValues, "companyName" | "title" | "nameAddressed" | "emailAddress" | "region">
+> &
+  Partial<Pick<ClientDetailsFormValues, "phone" | "addressLine1" | "addressLine2" | "addressLine3" | "addressLine4">>
+
+const directoryCache: { records: ClientAccountRow[] } = { records: [] }
+
+const toNullableString = (value: string | null | undefined): string | null => {
+  if (typeof value !== "string") {
+    return null
+  }
+  const trimmed = value.trim()
+  return trimmed.length > 0 ? trimmed : null
+}
+
+const formatDisplayValue = (value: string | null | undefined, fallback = "N/A") => {
+  const normalized = toNullableString(value)
+  return normalized ?? fallback
+}
+
+const composeDisplayName = (name: string | null, honorific: string | null, fallback?: string) => {
+  const safeName = name ?? fallback ?? "N/A"
+  return honorific ? `${honorific} ${safeName}`.trim() : safeName
+}
+
+const getInitials = (value: string) => {
+  const pieces = value
+    .split(/\s+/)
+    .filter(Boolean)
+    .slice(0, 2)
+  if (pieces.length === 0) return "NA"
+  if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase()
+  return `${pieces[0][0] ?? ""}${pieces[1][0] ?? ""}`.toUpperCase()
+}
+
+const hashString = (value: string) => {
+  let hash = 0
+  for (let i = 0; i < value.length; i += 1) {
+    hash = (hash << 5) - hash + value.charCodeAt(i)
+    hash |= 0
+  }
+  return hash
+}
+
+const getAvatarColor = (seed: string) => {
+  const base = Math.abs(hashString(seed))
+  const r = (base & 0xff0000) >> 16
+  const g = (base & 0x00ff00) >> 8
+  const b = base & 0x0000ff
+  return `rgb(${(r % 156) + 80}, ${(g % 156) + 80}, ${(b % 156) + 80})`
+}
+
+const formatAddressLines = (record: ClientAccountRow) => {
+  const lines: string[] = []
+  if (record.addressLine1) {
+    lines.push(record.addressLine1)
+  }
+  if (record.addressLine2) {
+    lines.push(record.addressLine2)
+  }
+  const tail: string[] = []
+  if (record.addressLine3) {
+    tail.push(record.addressLine3)
+  }
+  if (record.addressLine4) {
+    tail.push(record.addressLine4)
+  }
+  if (record.region) {
+    tail.push(record.region)
+  }
+  if (tail.length > 0) {
+    lines.push(tail.join(", "))
+  }
+  if (lines.length === 0) {
+    return ["N/A"]
+  }
+  return lines
+}
+
+const normalizeRecord = (raw: DirectoryApiRecord, index: number): ClientAccountRow => {
+  void index
+  const companyName = toNullableString(raw.companyName)
+  const companyDisplay = formatDisplayValue(companyName)
+  const honorific = toNullableString(raw.title)
+  const baseName = toNullableString(raw.nameAddressed) ?? toNullableString(raw.name)
+  const displayName = composeDisplayName(baseName, honorific, companyDisplay)
+
+  return {
+    id: raw.id,
+    displayName,
+    baseName,
+    honorific,
+    email: toNullableString(raw.emailAddress),
+    phone: toNullableString(raw.phone),
+    addressLine1: toNullableString(raw.addressLine1),
+    addressLine2: toNullableString(raw.addressLine2),
+    addressLine3: toNullableString(raw.addressLine3),
+    addressLine4: toNullableString(raw.addressLine4),
+    region: toNullableString(raw.region ?? raw.addressLine5),
+    company: {
+      id: raw.id,
+      name: companyDisplay,
+    },
+    hasOverduePayment: Boolean(raw.hasOverduePayment),
+    avatarSeed: displayName,
+    createdAt: raw.createdAt ?? null,
+    source: raw,
+  }
+}
+
+const isFieldFilter = (filter: ClientFilter): filter is ClientFilter & { field: string } =>
+  typeof filter === "object" && filter !== null && "field" in filter
+
+const applyFilters = (rows: ClientAccountRow[], filters?: CrudFilters): ClientAccountRow[] => {
+  if (!filters) return rows
+  return filters.reduce<ClientAccountRow[]>((result, filter) => {
+    if (!filter) return result
+    if (!isFieldFilter(filter)) {
+      return result
+    }
+    const { field, value } = filter
+    if (value == null || (Array.isArray(value) && value.length === 0)) {
+      return result
+    }
+
+    switch (field) {
+      case "name": {
+        if (typeof value === "string" && value.trim().length > 0) {
+          const needle = value.trim().toLowerCase()
+          return result.filter((row) =>
+            [row.displayName, row.company.name, formatDisplayValue(row.email), formatDisplayValue(row.region)]
+              .join(" ")
+              .toLowerCase()
+              .includes(needle),
+          )
+        }
+        return result
+      }
+      case "email": {
+        if (typeof value === "string" && value.trim().length > 0) {
+          const needle = value.trim().toLowerCase()
+          return result.filter((row) => (row.email ?? "").toLowerCase().includes(needle))
+        }
+        return result
+      }
+      case "companyName":
+      case "company.id": {
+        if (typeof value === "string" && value.trim().length > 0) {
+          const match = value.trim().toLowerCase()
+          return result.filter(
+            (row) => row.company.id.toLowerCase() === match || row.company.name.toLowerCase() === match,
+          )
+        }
+        return result
+      }
+      default:
+        return result
+    }
+  }, rows)
+}
+
+const applySorting = (rows: ClientAccountRow[], sorters?: CrudSorting): ClientAccountRow[] => {
+  if (!sorters || sorters.length === 0) return rows
+  const [{ field, order }] = sorters
+  if (!order) return rows
+  return [...rows].sort((a, b) => {
+    const direction = order === "asc" ? 1 : -1
+    const getValue = (record: ClientAccountRow) => {
+      switch (field) {
+        case "name":
+          return record.displayName
+        case "email":
+          return record.email ?? ""
+        case "companyName":
+        case "company.id":
+        case "company.name":
+          return record.company.name
+        default:
+          return record.displayName
+      }
+    }
+    const aValue = getValue(a)
+    const bValue = getValue(b)
+    return aValue.localeCompare(bValue, undefined, { sensitivity: "base" }) * direction
+  })
+}
+
+const refineDataProvider: DataProvider = {
+  getApiUrl: () => "/api",
+  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, sorters, filters }) => {
+    if (resource !== "client-directory") {
+      return { data: [], total: 0 } as GetListResponse<TData>
+    }
+
+    const response = await fetch("/api/client-directory", { credentials: "include" })
+    if (!response.ok) {
+      throw new Error("Failed to load client directory")
+    }
+
+    const payload = await response.json()
+    const rawItems: DirectoryApiRecord[] = payload.data ?? []
+    const normalized = rawItems.map((entry, index) => normalizeRecord(entry, index))
+    directoryCache.records = normalized
+
+    const filtered = applyFilters(normalized, filters)
+    const sorted = applySorting(filtered, sorters)
+
+    const current = pagination?.current ?? 1
+    const pageSize = pagination?.pageSize ?? 12
+    const start = (current - 1) * pageSize
+    const paginated = sorted.slice(start, start + pageSize)
+
+    return {
+      data: paginated as unknown as TData[],
+      total: sorted.length,
+    }
+  },
+  getOne: () => Promise.reject(new Error("Not implemented")),
+  getMany: () => Promise.reject(new Error("Not implemented")),
+  create: () => Promise.reject(new Error("Not implemented")),
+  update: () => Promise.reject(new Error("Not implemented")),
+  deleteOne: () => Promise.reject(new Error("Not implemented")),
+  deleteMany: () => Promise.reject(new Error("Not implemented")),
+  updateMany: () => Promise.reject(new Error("Not implemented")),
+  createMany: () => Promise.reject(new Error("Not implemented")),
+}
+
+const PaymentStatusTag = ({ overdue }: { overdue: boolean }) => (
+  <Tag color={overdue ? "red" : "green"} style={{ borderRadius: 999, textTransform: "capitalize" }}>
+    <Space size={6}>
+      {overdue ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
+      {overdue ? "Payment Overdue" : "Payment Clear"}
+    </Space>
+  </Tag>
+)
+
+const CustomAvatar = ({ seed, name }: { seed: string; name: string }) => (
+  <Avatar style={{ backgroundColor: getAvatarColor(seed) }}>{getInitials(name)}</Avatar>
+)
+
+const ActionButtons = ({ record, onViewDetails, onSendEmail, onCall }: ActionHandlers & { record: ClientAccountRow }) => (
+  <Space>
+    <Tooltip title="View details">
+      <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onViewDetails(record)} />
+    </Tooltip>
+    <Tooltip title="Send email">
+      <Button type="text" size="small" icon={<MailOutlined />} onClick={() => onSendEmail(record)} />
+    </Tooltip>
+    <Tooltip title="Call">
+      <Button type="text" size="small" icon={<PhoneOutlined />} onClick={() => onCall(record)} />
+    </Tooltip>
+  </Space>
+)
+
+type TableViewProps = {
+  tableProps: any
+  companyOptions: Array<{ value: string; label: string }>
+} & ActionHandlers
+
+const ClientAccountsTable = ({ tableProps, companyOptions, onViewDetails, onSendEmail, onCall }: TableViewProps) => (
+  <List
+    breadcrumb={false}
+    headerProps={{ title: null }}
+    contentProps={{
+      style: {
+        marginTop: 28,
+        background: "#fff",
+        borderRadius: 12,
+        padding: 0,
+        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
+      },
+    }}
+  >
+    <Table<ClientAccountRow>
+      {...tableProps}
+      rowKey="id"
+      pagination={{
+        ...tableProps.pagination,
+        pageSizeOptions: ["12", "24", "48", "96"],
+        showTotal: (total) => <PaginationSummary total={total} />,
+      }}
+    >
+      <Table.Column<ClientAccountRow>
+        dataIndex={["company", "name"]}
+        title="Company"
+        width={240}
+        filterDropdown={(props) => (
+          <FilterDropdown {...props}>
+            <Select
+              placeholder="Search Company"
+              style={{ width: 220 }}
+              showSearch
+              options={companyOptions}
+              filterOption={(input, option) =>
+                (option?.label as string).toLowerCase().includes(input.toLowerCase())
+              }
+            />
+          </FilterDropdown>
+        )}
+        render={(_, record) => <Text strong>{record.company.name}</Text>}
+      />
+      <Table.Column<ClientAccountRow>
+        dataIndex="displayName"
+        title="Name"
+        width={280}
+        render={(_, record) => (
+          <Space align="start">
+            <CustomAvatar seed={record.avatarSeed} name={record.displayName} />
+            <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
+              <Text strong>{record.displayName}</Text>
+              <Text type="secondary">{formatDisplayValue(record.phone)}</Text>
+            </Space>
+          </Space>
+        )}
+        filterDropdown={(props) => (
+          <FilterDropdown {...props}>
+            <Input placeholder="Search Name" />
+          </FilterDropdown>
+        )}
+      />
+      <Table.Column<ClientAccountRow>
+        dataIndex="email"
+        title="Email"
+        filterDropdown={(props) => (
+          <FilterDropdown {...props}>
+            <Input placeholder="Search Email" />
+          </FilterDropdown>
+        )}
+        render={(_, record) => <Text>{formatDisplayValue(record.email)}</Text>}
+      />
+      <Table.Column<ClientAccountRow>
+        title="Actions"
+        fixed="right"
+        align="right"
+        render={(_, record) => (
+          <ActionButtons
+            record={record}
+            onViewDetails={onViewDetails}
+            onSendEmail={onSendEmail}
+            onCall={onCall}
+          />
+        )}
+      />
+    </Table>
+  </List>
+)
+
+type CardGridProps = {
+  tableProps: any
+  setCurrentPage: (page: number) => void
+  setPageSize: (size: number) => void
+  onViewDetails: (record: ClientAccountRow) => void
+  onSendEmail: (record: ClientAccountRow) => void
+  onCall: (record: ClientAccountRow) => void
+}
+
+const ClientCards = ({
+  tableProps: { dataSource, pagination, loading },
+  setCurrentPage,
+  setPageSize,
+  onViewDetails,
+  onSendEmail,
+  onCall,
+}: CardGridProps) => {
+  const data = useMemo(() => dataSource ?? [], [dataSource])
+  const isLoading = useMemo(() => {
+    if (typeof loading === "boolean") {
+      return loading
+    }
+    if (!loading) {
+      return false
+    }
+    if (typeof loading === "object" && "spinning" in loading) {
+      return Boolean(loading.spinning)
+    }
+    return Boolean(loading)
+  }, [loading])
+  const paginationConfig = pagination && typeof pagination === "object" ? pagination : undefined
+  const current = paginationConfig?.current ?? 1
+  const pageSize = paginationConfig?.pageSize ?? 12
+  const total = paginationConfig?.total ?? data.length
+
+  return (
+    <List breadcrumb={false} headerProps={{ title: null }} contentProps={{ style: { marginTop: 28 } }}>
+      <div
+        style={{
+          display: "grid",
+          gap: 24,
+          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
+        }}
+      >
+        {(isLoading
+          ? Array.from({ length: 12 }).map((_, index) => ({ ...placeholderCard, id: `placeholder-${index}` }))
+          : data
+        ).map((record) => (
+          <ClientCard
+            key={record.id}
+            record={record}
+            loading={isLoading}
+            onViewDetails={onViewDetails}
+            onSendEmail={onSendEmail}
+            onCall={onCall}
+          />
+        ))}
+      </div>
+      <div
+        style={{
+          display: "flex",
+          justifyContent: "flex-end",
+          marginTop: 24,
+        }}
+      >
+        <Pagination
+          current={current}
+          pageSize={pageSize}
+          total={total}
+          hideOnSinglePage
+          pageSizeOptions={["12", "24", "48"]}
+          showLessItems
+          showSizeChanger
+          showTotal={(count) => <PaginationSummary total={count} />}
+          onChange={(page, nextPageSize) => {
+            setCurrentPage(page)
+            setPageSize(nextPageSize ?? pageSize)
+          }}
+        />
+      </div>
+    </List>
+  )
+}
+
+const placeholderCard: ClientAccountRow = {
+  id: "placeholder",
+  displayName: "Loading",
+  baseName: "Loading",
+  honorific: null,
+  email: null,
+  phone: null,
+  addressLine1: null,
+  addressLine2: null,
+  addressLine3: null,
+  addressLine4: null,
+  region: null,
+  company: { id: "placeholder", name: "Loading" },
+  hasOverduePayment: false,
+  avatarSeed: "Loading",
+  createdAt: null,
+  source: {
+    id: "placeholder",
+    documentId: "placeholder",
+    companyName: "Loading",
+    title: null,
+    name: null,
+    nameAddressed: null,
+    emailAddress: null,
+    phone: null,
+    addressLine1: null,
+    addressLine2: null,
+    addressLine3: null,
+    addressLine4: null,
+    addressLine5: null,
+    region: null,
+    createdAt: null,
+    hasOverduePayment: false,
+  },
+}
+
+type ClientCardProps = {
+  record: ClientAccountRow
+  loading?: boolean
+} & ActionHandlers
+
+const CardSection = ({ title, value, showLabel = true }: { title: string; value: string; showLabel?: boolean }) => (
+  <div>
+    {showLabel ? (
+      <Text type="secondary" style={{ display: "block", textTransform: "uppercase", fontSize: 12 }}>
+        {title}
+      </Text>
+    ) : null}
+    <Text strong>{value}</Text>
+  </div>
+)
+
+const ClientCard = ({ record, loading, onViewDetails, onSendEmail, onCall }: ClientCardProps) => (
+  <div
+    style={{
+      display: "flex",
+      flexDirection: "column",
+      borderRadius: 12,
+      background: "#fff",
+      boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
+      minHeight: 260,
+      position: "relative",
+      overflow: "hidden",
+    }}
+  >
+    <div
+      style={{
+        position: "absolute",
+        top: 12,
+        right: 12,
+      }}
+    >
+      <PaymentStatusTag overdue={record.hasOverduePayment} />
+    </div>
+    <div
+      style={{
+        padding: "32px 24px 16px",
+        display: "flex",
+        flexDirection: "column",
+        alignItems: "center",
+        gap: 12,
+        textAlign: "center",
+      }}
+    >
+      <Avatar size={64} style={{ backgroundColor: getAvatarColor(record.avatarSeed) }}>
+        {getInitials(record.displayName)}
+      </Avatar>
+      <div>
+        <Text strong style={{ fontSize: 18 }}>
+          {loading ? "Loading" : record.displayName}
+        </Text>
+        <div>
+          <Text type="secondary">{loading ? "" : formatDisplayValue(record.email)}</Text>
+        </div>
+      </div>
+    </div>
+    <div
+      style={{
+        padding: "16px 24px",
+        borderTop: "1px solid #edf1f4",
+        display: "grid",
+        gap: 12,
+      }}
+    >
+      <CardSection title="Company" value={record.company.name} showLabel={false} />
+      <CardSection title="Phone" value={formatDisplayValue(record.phone)} />
+      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
+        <Button type="text" icon={<EyeOutlined />} onClick={() => onViewDetails(record)}>
+          View
+        </Button>
+        <Button type="text" icon={<MailOutlined />} onClick={() => onSendEmail(record)}>
+          Email
+        </Button>
+        <Button type="text" icon={<PhoneOutlined />} onClick={() => onCall(record)}>
+          Call
+        </Button>
+      </div>
+    </div>
+  </div>
+)
+
+const DetailField = ({ label, value }: { label: string; value: ReactNode }) => (
+  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
+    <Text type="secondary" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
+      {label}:
+    </Text>
+    <Text strong>{value}</Text>
+  </div>
+)
+
+const ClientDetailsDrawer = ({
+  record,
+  open,
+  saving,
+  onClose,
+  onDelete,
+  onSubmit,
+}: {
+  record: ClientAccountRow | null
+  open: boolean
+  saving: boolean
+  onClose: () => void
+  onDelete: (record: ClientAccountRow) => void
+  onSubmit: (values: ClientDetailsFormValues) => Promise<void>
+}) => {
+  const [form] = Form.useForm()
+
+  useEffect(() => {
+    if (record) {
+      form.setFieldsValue({
+        companyName: record.source.companyName ?? record.company.name,
+        title: record.source.title ?? undefined,
+        nameAddressed: record.source.nameAddressed ?? record.baseName ?? undefined,
+        emailAddress: record.source.emailAddress ?? record.email ?? undefined,
+        phone: record.source.phone ?? record.phone ?? undefined,
+        addressLine1: record.source.addressLine1 ?? record.addressLine1 ?? undefined,
+        addressLine2: record.source.addressLine2 ?? record.addressLine2 ?? undefined,
+        addressLine3: record.source.addressLine3 ?? record.addressLine3 ?? undefined,
+        addressLine4: record.source.addressLine4 ?? record.addressLine4 ?? undefined,
+        region: record.source.region ?? record.region ?? undefined,
+      })
+    } else {
+      form.resetFields()
+    }
+  }, [record, form])
+
+  return (
+    <Drawer placement="right" width={480} open={open} onClose={onClose} destroyOnClose title={null}>
+      {record ? (
+        <Space direction="vertical" size={24} style={{ width: "100%" }}>
+          <Space align="center" size={16}>
+            <Avatar size={64} style={{ backgroundColor: getAvatarColor(record.avatarSeed) }}>
+              {getInitials(record.displayName)}
+            </Avatar>
+            <Space direction="vertical" size={4}>
+              <Text strong style={{ fontSize: 20 }}>
+                {record.displayName}
+              </Text>
+              <PaymentStatusTag overdue={record.hasOverduePayment} />
+            </Space>
+          </Space>
+          <Space direction="vertical" size={16} style={{ width: "100%" }}>
+            <DetailField label="Company" value={record.company.name} />
+            <DetailField label="Representative" value={record.displayName} />
+            <DetailField label="Email" value={formatDisplayValue(record.email)} />
+            <DetailField label="Phone" value={formatDisplayValue(record.phone)} />
+            <DetailField
+              label="Address"
+              value={
+                <span>
+                  {formatAddressLines(record).map((line) => (
+                    <span key={line} style={{ display: "block" }}>
+                      {line}
+                    </span>
+                  ))}
+                </span>
+              }
+            />
+          </Space>
+          <Divider style={{ margin: "8px 0" }} />
+          <Form<ClientDetailsFormValues>
+            layout="vertical"
+            form={form}
+            onFinish={onSubmit}
+            initialValues={{ title: "Mr.", region: "Kowloon" }}
+          >
+            <Form.Item
+              label="Company Name"
+              name="companyName"
+              rules={[{ required: true, message: "Company name is required" }]}
+            >
+              <Input placeholder="Enter company name" />
+            </Form.Item>
+            <Form.Item label="Title" name="title">
+              <Select
+                placeholder="Select title"
+                allowClear
+                options={[
+                  { label: "Mr.", value: "Mr." },
+                  { label: "Mrs.", value: "Mrs." },
+                  { label: "Ms.", value: "Ms." },
+                ]}
+              />
+            </Form.Item>
+            <Form.Item label="Representative" name="nameAddressed">
+              <Input placeholder="Enter representative name" />
+            </Form.Item>
+            <Form.Item label="Email" name="emailAddress">
+              <Input placeholder="Enter email" type="email" />
+            </Form.Item>
+            <Form.Item label="Phone" name="phone">
+              <Input placeholder="Enter phone" />
+            </Form.Item>
+            <Form.Item label="Address Line 1" name="addressLine1">
+              <Input placeholder="Address line 1" />
+            </Form.Item>
+            <Form.Item label="Address Line 2" name="addressLine2">
+              <Input placeholder="Address line 2" />
+            </Form.Item>
+            <Form.Item label="Address Line 3" name="addressLine3">
+              <Input placeholder="Address line 3" />
+            </Form.Item>
+            <Form.Item label="Address Line 4" name="addressLine4">
+              <Input placeholder="Address line 4" />
+            </Form.Item>
+            <Form.Item label="Region" name="region">
+              <Select
+                placeholder="Select region"
+                allowClear
+                options={[
+                  { label: "Kowloon", value: "Kowloon" },
+                  { label: "Hong Kong", value: "Hong Kong" },
+                  { label: "New Territories", value: "New Territories" },
+                ]}
+              />
+            </Form.Item>
+            <Form.Item>
+              <Space>
+                <Button onClick={() => form.resetFields()} disabled={saving}>
+                  Reset
+                </Button>
+                <Button type="primary" htmlType="submit" loading={saving}>
+                  Save changes
+                </Button>
+              </Space>
+            </Form.Item>
+          </Form>
+          <div style={{ display: "flex", justifyContent: "flex-start" }}>
+            <Button danger onClick={() => onDelete(record)}>
+              Delete client account
+            </Button>
+          </div>
+        </Space>
+      ) : (
+        <div style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
+          <Spin />
+        </div>
+      )}
+    </Drawer>
+  )
+}
+
+const PaginationSummary = ({ total }: { total: number }) => (
+  <span style={{ marginLeft: 16 }}>
+    <Text strong>{total}</Text> clients in total
+  </span>
+)
+
+const AddClientModal = ({
+  open,
+  loading,
+  onCancel,
+  onSubmit,
+}: {
+  open: boolean
+  loading: boolean
+  onCancel: () => void
+  onSubmit: (values: AddClientFormValues) => Promise<void>
+}) => {
+  const [form] = Form.useForm()
+
+  useEffect(() => {
+    if (open) {
+      form.resetFields()
+      form.setFieldsValue({ title: "Mr.", region: "Kowloon" } as Partial<AddClientFormValues>)
+    }
+  }, [open, form])
+
+  return (
+    <Modal
+      open={open}
+      title="Add client"
+      onCancel={onCancel}
+      okText="Create"
+      confirmLoading={loading}
+      onOk={() => form.submit()}
+      destroyOnClose
+    >
+      <Form<AddClientFormValues>
+        layout="vertical"
+        form={form}
+        onFinish={onSubmit}
+        initialValues={{ title: "Mr.", region: "Kowloon" }}
+      >
+        <Form.Item
+          label="Company Name"
+          name="companyName"
+          rules={[{ required: true, message: "Company name is required" }]}
+        >
+          <Input placeholder="Enter company name" />
+        </Form.Item>
+        <Form.Item label="Title" name="title">
+          <Select
+            options={[
+              { label: "Mr.", value: "Mr." },
+              { label: "Mrs.", value: "Mrs." },
+              { label: "Ms.", value: "Ms." },
+            ]}
+          />
+        </Form.Item>
+        <Form.Item label="Representative" name="nameAddressed">
+          <Input placeholder="Representative name" />
+        </Form.Item>
+        <Form.Item label="Email" name="emailAddress">
+          <Input placeholder="Email" type="email" />
+        </Form.Item>
+        <Form.Item label="Phone" name="phone">
+          <Input placeholder="Phone" />
+        </Form.Item>
+        <Form.Item label="Address Line 1" name="addressLine1">
+          <Input placeholder="Address line 1" />
+        </Form.Item>
+        <Form.Item label="Address Line 2" name="addressLine2">
+          <Input placeholder="Address line 2" />
+        </Form.Item>
+        <Form.Item label="Address Line 3" name="addressLine3">
+          <Input placeholder="Address line 3" />
+        </Form.Item>
+        <Form.Item label="Address Line 4" name="addressLine4">
+          <Input placeholder="Address line 4" />
+        </Form.Item>
+        <Form.Item label="Region" name="region">
+          <Select
+            options={[
+              { label: "Kowloon", value: "Kowloon" },
+              { label: "Hong Kong", value: "Hong Kong" },
+              { label: "New Territories", value: "New Territories" },
+            ]}
+          />
+        </Form.Item>
+      </Form>
+    </Modal>
+  )
+}
+
+const NavigationSider = ({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: (value: boolean) => void }) => {
+  const { menuItems, selectedKey } = useMenu()
+  const breakpoint = Grid.useBreakpoint()
+  const isMobile = typeof breakpoint.lg === "undefined" ? false : !breakpoint.lg
+
+  const navigationItems = menuItems
+    .map((item) => {
+      const key = item.key ?? item.name
+      const route = item.route ?? item.list
+      if (!route) {
+        return null
+      }
+      return {
+        key,
+        icon: iconForMenu(item.name ?? ""),
+        label: item.label,
+        route,
+      }
+    })
+    .filter(Boolean) as Array<{ key: string; icon: ReactNode; label: ReactNode; route: string }>
+
+  const handleMenuClick = (event: { key: string }) => {
+    if (event.key === "__collapse__") {
+      onCollapse(!collapsed)
+      return
+    }
+    const target = navigationItems.find((item) => item.key === event.key)
+    if (target?.route && typeof window !== "undefined") {
+      window.location.href = target.route
+    }
+  }
+
+  const menuEntries = [
+    ...navigationItems.map((item) => ({
+      key: item.key,
+      icon: item.icon,
+      label: item.label,
+    })),
+    {
+      key: "__collapse__",
+      icon: collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />,
+      label: collapsed ? "Expand sidebar" : "Collapse sidebar",
+      style: { marginTop: "auto" },
+    },
+  ]
+
+  const content = (
+    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
+      <div
+        style={{
+          height: 64,
+          display: "flex",
+          alignItems: "center",
+          gap: 12,
+          padding: collapsed ? "0 12px" : "0 24px",
+          borderBottom: "1px solid #e5e7eb",
+        }}
+      >
+        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
+          <Avatar shape="square" size={36} style={{ backgroundColor: "#2563eb" }}>
+            <ThunderboltFilled />
+          </Avatar>
+          {!collapsed ? (
+            <Text strong style={{ fontSize: 18 }}>
+              The Establishers
+            </Text>
+          ) : null}
+        </div>
+      </div>
+      <Menu
+        mode="inline"
+        selectedKeys={selectedKey ? [selectedKey] : []}
+        style={{
+          display: "flex",
+          flexDirection: "column",
+          height: "100%",
+          borderInlineEnd: "none",
+          paddingTop: 16,
+        }}
+        items={menuEntries}
+        onClick={handleMenuClick}
+      />
+    </div>
+  )
+
+  if (isMobile) {
+    return (
+      <>
+        <Button
+          type="primary"
+          icon={<BarsOutlined />}
+          style={{ position: "fixed", top: 72, left: 0, zIndex: 1300, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
+          onClick={() => onCollapse(!collapsed)}
+        />
+        <Drawer placement="left" open={!collapsed} onClose={() => onCollapse(true)} width={256} bodyStyle={{ padding: 0 }}>
+          {content}
+        </Drawer>
+      </>
+    )
+  }
+
+  return (
+    <Sider
+      width={256}
+      collapsible
+      collapsed={collapsed}
+      onCollapse={onCollapse}
+      trigger={null}
+      style={{
+        background: "#fff",
+        position: "sticky",
+        top: 0,
+        height: "100vh",
+      }}
+    >
+      {content}
+    </Sider>
+  )
+}
+
+const iconForMenu = (name: string) => {
+  switch (name) {
+    case "dashboard":
+      return <AppstoreOutlined />
+    case "calendar":
+      return <CalendarOutlined />
+    case "scrumboard":
+      return <AppstoreOutlined />
+    case "companies":
+      return <ApartmentOutlined />
+    case "client-directory":
+      return <TeamOutlined />
+    case "quotes":
+      return <SettingOutlined />
+    case "administration":
+      return <SettingOutlined />
+    default:
+      return <UnorderedListOutlined />
+  }
+}
+
+const TopHeader = () => (
+  <Header
+    style={{
+      background: "#fff",
+      display: "flex",
+      alignItems: "center",
+      justifyContent: "flex-end",
+      padding: "0 32px",
+      position: "sticky",
+      top: 0,
+      zIndex: 1000,
+      height: 64,
+      borderBottom: "1px solid #e5e7eb",
+    }}
+  >
+    <Space size="large" align="center">
+      <Tooltip title="Notifications">
+        <Badge dot>
+          <Button type="text" shape="circle" icon={<BellOutlined />} />
+        </Badge>
+      </Tooltip>
+      <Avatar style={{ backgroundColor: "#1e3a8a", color: "#fff" }}>TE</Avatar>
+    </Space>
+  </Header>
+)
+
+const ClientAccountsContent = () => {
+  const [view, setView] = useState<ViewMode>("table")
+  const [searchForm] = Form.useForm()
+  const screens = Grid.useBreakpoint()
+  const { message } = AntdApp.useApp()
+  const [detailsRecord, setDetailsRecord] = useState<ClientAccountRow | null>(null)
+  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
+  const [isDetailsSaving, setIsDetailsSaving] = useState(false)
+  const [isAddOpen, setIsAddOpen] = useState(false)
+  const [isAdding, setIsAdding] = useState(false)
+
+  const { tableProps, searchFormProps, setCurrentPage, setPageSize, tableQuery } = useTable({
+    resource: "client-directory",
+    pagination: {
+      pageSize: 12,
+    },
+    sorters: {
+      initial: [
+        {
+          field: "companyName",
+          order: "asc",
+        },
+      ],
+    },
+    filters: {
+      initial: [
+        { field: "name", operator: "contains", value: undefined },
+        { field: "email", operator: "contains", value: undefined },
+        { field: "company.id", operator: "eq", value: undefined },
+      ],
+    },
+    onSearch: (values) => [
+      {
+        field: "name",
+        operator: "contains",
+        value: values.name,
+      },
+    ],
+    syncWithLocation: false,
+  }) as any
+
+  const debouncedSearch = useMemo(
+    () =>
+      debounce((value: string) => {
+        searchFormProps?.onFinish?.({ name: value })
+      }, 400),
+    [searchFormProps],
+  )
+
+  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])
+
+  const handleViewChange = (next: ViewMode) => {
+    setView(next)
+    searchFormProps?.form?.resetFields()
+    searchForm?.resetFields()
+  }
+
+  const companyOptions = useMemo(() => {
+    const unique = new Map<string, string>()
+    directoryCache.records.forEach((record) => {
+      if (!unique.has(record.company.id)) {
+        unique.set(record.company.id, record.company.name)
+      }
+    })
+    return Array.from(unique.entries()).map(([value, label]) => ({ value, label }))
+  }, [tableQuery.data?.data])
+
+  const refreshDirectory = async () => {
+    await tableQuery.refetch()
+  }
+
+  const handleViewDetails = (record: ClientAccountRow) => {
+    setDetailsRecord(record)
+    setIsDetailsOpen(true)
+  }
+
+  const handleSendEmail = (record: ClientAccountRow) => {
+    if (!record.email) {
+      message.warning("No email address is available for this client.")
+      return
+    }
+    if (typeof window !== "undefined") {
+      window.open(`mailto:${record.email}`)
+    }
+  }
+
+  const handleCall = (record: ClientAccountRow) => {
+    if (!record.phone) {
+      message.warning("No phone number is available for this client.")
+      return
+    }
+    if (typeof window !== "undefined") {
+      const normalized = record.phone.replace(/[^\d+]/g, "")
+      window.open(`tel:${normalized}`)
+    }
+  }
+
+  const handleDeleteRequest = (record: ClientAccountRow) => {
+    void record
+    message.info("Delete client account is not available in this preview build yet.")
+  }
+
+  const handleCloseDetails = () => {
+    setIsDetailsOpen(false)
+    setDetailsRecord(null)
+  }
+
+  const handleAddSubmit = async (values: AddClientFormValues) => {
+    setIsAdding(true)
+    try {
+      const response = await fetch("/api/client-directory", {
+        method: "POST",
+        headers: { "Content-Type": "application/json" },
+        body: JSON.stringify({
+          client: {
+            companyName: values.companyName,
+            title: values.title,
+            nameAddressed: values.nameAddressed,
+            name: values.nameAddressed,
+            emailAddress: values.emailAddress,
+            phone: values.phone,
+            addressLine1: values.addressLine1,
+            addressLine2: values.addressLine2,
+            addressLine3: values.addressLine3,
+            addressLine4: values.addressLine4,
+            addressLine5: values.region,
+            region: values.region,
+          },
+        }),
+      })
+      if (!response.ok) {
+        const errorJson = await response.json().catch(() => ({}))
+        throw new Error(errorJson.error ?? "Failed to add client")
+      }
+      await refreshDirectory()
+      message.success("Client added successfully")
+      setIsAddOpen(false)
+    } catch (error) {
+      const err = error instanceof Error ? error.message : "Failed to add client"
+      message.error(err)
+    } finally {
+      setIsAdding(false)
+    }
+  }
+
+  const handleDetailsSubmit = async (values: ClientDetailsFormValues) => {
+    if (!detailsRecord) {
+      return
+    }
+    setIsDetailsSaving(true)
+    try {
+      const response = await fetch(`/api/client-directory/${encodeURIComponent(detailsRecord.id)}`, {
+        method: "PATCH",
+        headers: { "Content-Type": "application/json" },
+        body: JSON.stringify({
+          updates: {
+            companyName: values.companyName,
+            title: values.title,
+            nameAddressed: values.nameAddressed,
+            name: values.nameAddressed,
+            emailAddress: values.emailAddress,
+            phone: values.phone,
+            addressLine1: values.addressLine1,
+            addressLine2: values.addressLine2,
+            addressLine3: values.addressLine3,
+            addressLine4: values.addressLine4,
+            addressLine5: values.region,
+            region: values.region,
+          },
+        }),
+      })
+      if (!response.ok) {
+        const errorJson = await response.json().catch(() => ({}))
+        throw new Error(errorJson.error ?? "Failed to update client")
+      }
+      await refreshDirectory()
+      const refreshed = directoryCache.records.find((entry) => entry.id === detailsRecord.id)
+      if (refreshed) {
+        setDetailsRecord(refreshed)
+      }
+      message.success("Client updated")
+    } catch (error) {
+      const err = error instanceof Error ? error.message : "Failed to update client"
+      message.error(err)
+    } finally {
+      setIsDetailsSaving(false)
+    }
+  }
+
+  return (
+    <div
+      style={{
+        padding: screens.md ? "32px 32px 32px 24px" : "24px 16px",
+        minHeight: "100%",
+        background: "#fff",
+      }}
+    >
+      <div
+        style={{
+          maxWidth: 1120,
+          margin: 0,
+          width: "100%",
+        }}
+      >
+        <div
+          style={{
+            display: "flex",
+            flexDirection: screens.md ? "row" : "column",
+            alignItems: screens.md ? "center" : "stretch",
+            gap: screens.md ? 12 : 8,
+            marginBottom: 24,
+            width: "100%",
+            flexWrap: screens.md ? "nowrap" : "wrap",
+          }}
+        >
+          <Form
+            form={searchForm}
+            {...searchFormProps}
+            layout="inline"
+            style={{
+              marginBottom: 0,
+              width: screens.md ? 200 : "100%",
+            }}
+          >
+            <Form.Item name="name" style={{ marginBottom: 0, width: "100%" }}>
+              <Input
+                size="large"
+                placeholder="Search by name"
+                prefix={<SearchOutlined className="anticon tertiary" />}
+                suffix={<Spin size="small" spinning={tableQuery.isFetching} />}
+                onChange={(event) => debouncedSearch(event.target.value)}
+                style={{ width: "100%" }}
+              />
+            </Form.Item>
+          </Form>
+          {screens.md ? (
+            <Radio.Group
+              size="large"
+              value={view}
+              onChange={(event) => handleViewChange(event.target.value)}
+              buttonStyle="solid"
+              style={{
+                background: "#f0f4ff",
+                borderRadius: 999,
+                padding: 4,
+              }}
+            >
+              <Radio.Button value="table">
+                <UnorderedListOutlined />
+              </Radio.Button>
+              <Radio.Button value="card">
+                <AppstoreOutlined />
+              </Radio.Button>
+            </Radio.Group>
+          ) : null}
+          <Button
+            type="primary"
+            size="large"
+            icon={<PlusCircleOutlined />}
+            onClick={() => setIsAddOpen(true)}
+            style={{
+              borderRadius: 999,
+              paddingInline: 20,
+            }}
+          >
+            Add
+          </Button>
+        </div>
+        {!screens.md ? (
+          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
+            <Radio.Group
+              size="large"
+              value={view}
+              onChange={(event) => handleViewChange(event.target.value)}
+              buttonStyle="solid"
+              style={{
+                background: "#f0f4ff",
+                borderRadius: 999,
+                padding: 4,
+              }}
+            >
+              <Radio.Button value="table">
+                <UnorderedListOutlined />
+              </Radio.Button>
+              <Radio.Button value="card">
+                <AppstoreOutlined />
+              </Radio.Button>
+            </Radio.Group>
+          </div>
+        ) : null}
+        {view === "table" ? (
+          <ClientAccountsTable
+            tableProps={tableProps}
+            companyOptions={companyOptions}
+            onViewDetails={handleViewDetails}
+            onSendEmail={handleSendEmail}
+            onCall={handleCall}
+          />
+        ) : (
+          <ClientCards
+            tableProps={tableProps}
+            setCurrentPage={setCurrentPage}
+            setPageSize={setPageSize}
+            onViewDetails={handleViewDetails}
+            onSendEmail={handleSendEmail}
+            onCall={handleCall}
+          />
+        )}
+      </div>
+      <ClientDetailsDrawer
+        record={detailsRecord}
+        open={isDetailsOpen}
+        saving={isDetailsSaving}
+        onClose={handleCloseDetails}
+        onDelete={handleDeleteRequest}
+        onSubmit={handleDetailsSubmit}
+      />
+      <AddClientModal
+        open={isAddOpen}
+        loading={isAdding}
+        onCancel={() => setIsAddOpen(false)}
+        onSubmit={handleAddSubmit}
+      />
+    </div>
+  )
+}
+
+const ClientAccountsShell = () => {
+  const [collapsed, setCollapsed] = useState(true)
+
+  return (
+    <ConfigProvider
+      theme={{
+        token: {
+          colorPrimary: "#2563eb",
+          borderRadius: 10,
+          fontFamily:
+            "'Inter', 'Inter var', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
+        },
+        components: {
+          Button: {
+            fontWeight: 600,
+            borderRadius: 999,
+          },
+        },
+      }}
+    >
+      <AntdApp>
+        <Refine
+          dataProvider={refineDataProvider}
+          routerProvider={routerProvider}
+          resources={[
+            { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
+            { name: "calendar", list: "/dashboard/calendar", meta: { label: "Calendar" } },
+            { name: "scrumboard", list: "/dashboard/scrumboard", meta: { label: "Scrumboard" } },
+            { name: "companies", list: "/dashboard/companies", meta: { label: "Companies" } },
+            {
+              name: "client-directory",
+              list: "/dashboard/new-ui/client-accounts",
+              meta: { label: "Client Accounts" },
+            },
+            { name: "quotes", list: "/dashboard/quotes", meta: { label: "Quotes" } },
+            { name: "administration", list: "/dashboard/administration", meta: { label: "Administration" } },
+          ]}
+          options={{ syncWithLocation: false }}
+        >
+          <Layout style={{ minHeight: "100vh", background: "#fff" }}>
+            <NavigationSider collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} />
+            <Layout style={{ background: "#fff" }}>
+              <TopHeader />
+              <Content>
+                <ClientAccountsContent />
+              </Content>
+            </Layout>
+          </Layout>
+        </Refine>
+      </AntdApp>
+    </ConfigProvider>
+  )
+}
+
+export default ClientAccountsShell
diff --git a/docs/client-accounts-runtime.md b/docs/client-accounts-runtime.md
new file mode 100644
index 0000000..286e049
--- /dev/null
+++ b/docs/client-accounts-runtime.md
@@ -0,0 +1,12 @@
+# Client Accounts Refine UI Runtime Notes
+
+We chased the 500 errors on `/dashboard/new-ui/client-accounts` back to the server bundle pulling Ant Design's browser-only modules.
+The fix was to keep the SSR guard but dynamically import the Refine shell so those heavy packages never touch the server render path.
+
+When touching this page again, double check the following before pushing:
+
+- `pages/dashboard/new-ui/client-accounts.tsx` must keep the dynamic `ssr: false` import.
+- All Ant Design styling should live in client components (see `NewUIClientAccountsApp`).
+- Run `CI=1 npm run build` locally so we catch any regressions before Vercel does.
+
+If a future build throws a similar 500, confirm these guardrails first. They eliminated the crash this time.
diff --git a/lib/clientDirectory.ts b/lib/clientDirectory.ts
index 3710436..95c72a9 100644
--- a/lib/clientDirectory.ts
+++ b/lib/clientDirectory.ts
@@ -1,6 +1,7 @@
 // lib/clientDirectory.ts
 
 import {
+  Timestamp,
   addDoc,
   collection,
   doc,
@@ -11,9 +12,11 @@ import {
   updateDoc,
 } from 'firebase/firestore'
 
-import { getFirestoreForDatabase } from './firebase'
+import { getFirestoreForDatabase, getFirebaseDiagnosticsSnapshot } from './firebase'
+import { fetchProjectsFromDatabase } from './projectsDatabase'
 
 export interface ClientDirectoryRecord {
+  documentId: string
   companyName: string
   title: string | null
   name: string | null
@@ -26,6 +29,8 @@ export interface ClientDirectoryRecord {
   addressLine4: string | null
   addressLine5: string | null
   region: string | null
+  createdAt: string | null
+  hasOverduePayment: boolean
 }
 
 const sanitizeString = (value: unknown): string | null => {
@@ -36,45 +41,123 @@ const sanitizeString = (value: unknown): string | null => {
   return null
 }
 
-export const fetchClientsDirectory = async (): Promise<ClientDirectoryRecord[]> => {
-  const directoryDb = getFirestoreForDatabase('epl-directory')
-  const snap = await getDocs(collection(directoryDb, 'clients'))
+const normalizeCompanyKey = (value: string | null | undefined) => {
+  if (typeof value !== 'string') {
+    return null
+  }
+  const trimmed = value.trim()
+  return trimmed.length > 0 ? trimmed.toLowerCase() : null
+}
 
-  const records: ClientDirectoryRecord[] = snap.docs.map((doc) => {
-    const data = doc.data() as Record<string, unknown>
-    const companyName = sanitizeString(data.companyName) ?? doc.id
-    const title = sanitizeString(data.title)
-    const name = sanitizeString(data.name)
-    let nameAddressed = sanitizeString(data.nameAddressed)
+const computeOverdueCompanySet = async (): Promise<Set<string>> => {
+  try {
+    const { projects } = await fetchProjectsFromDatabase()
+    const overdue = new Set<string>()
+
+    projects.forEach((project) => {
+      if (project.paid === false) {
+        const key = normalizeCompanyKey(project.clientCompany)
+        if (key) {
+          overdue.add(key)
+        }
+      }
+    })
+
+    return overdue
+  } catch (error) {
+    console.error('[client-directory] Failed to compute payment diagnostics from projects database', {
+      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
+    })
+    return new Set<string>()
+  }
+}
 
-    if (!nameAddressed) {
-      nameAddressed = name ?? null
-    }
+export const fetchClientsDirectory = async (): Promise<ClientDirectoryRecord[]> => {
+  console.info('[client-directory] Fetching clients from Firestore', {
+    databaseId: 'epl-directory',
+  })
 
-    if (title && nameAddressed) {
-      const normalizedTitle = title.toLowerCase()
-      if (nameAddressed.toLowerCase().startsWith(normalizedTitle)) {
-        nameAddressed = nameAddressed.slice(title.length).trimStart()
+  try {
+    const directoryDb = getFirestoreForDatabase('epl-directory')
+    const [overdueCompanies, snap] = await Promise.all([
+      computeOverdueCompanySet(),
+      getDocs(collection(directoryDb, 'clients')),
+    ])
+
+    const records: ClientDirectoryRecord[] = snap.docs.map((doc) => {
+      const data = doc.data() as Record<string, unknown>
+      const documentId = doc.id
+      const companyName = sanitizeString(data.companyName) ?? doc.id
+      const title = sanitizeString(data.title)
+      const name = sanitizeString(data.name)
+      let nameAddressed = sanitizeString(data.nameAddressed)
+
+      if (!nameAddressed) {
+        nameAddressed = name ?? null
       }
-    }
 
-    return {
-      companyName,
-      title,
-      name,
-      nameAddressed,
-      emailAddress: sanitizeString(data.email) ?? sanitizeString(data.emailAddress),
-      phone: sanitizeString(data.phone),
-      addressLine1: sanitizeString(data.addressLine1),
-      addressLine2: sanitizeString(data.addressLine2),
-      addressLine3: sanitizeString(data.addressLine3),
-      addressLine4: sanitizeString(data.addressLine4),
-      addressLine5: sanitizeString(data.addressLine5),
-      region: sanitizeString(data.region),
-    }
-  })
+      if (title && nameAddressed) {
+        const normalizedTitle = title.toLowerCase()
+        if (nameAddressed.toLowerCase().startsWith(normalizedTitle)) {
+          nameAddressed = nameAddressed.slice(title.length).trimStart()
+        }
+      }
 
-  return records.sort((a, b) => a.companyName.localeCompare(b.companyName))
+      let createdAt: string | null = null
+      const rawCreatedAt = data.createdAt
+      if (rawCreatedAt instanceof Timestamp) {
+        createdAt = rawCreatedAt.toDate().toISOString()
+      } else if (typeof rawCreatedAt === 'string') {
+        const parsed = new Date(rawCreatedAt)
+        createdAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
+      }
+
+      return {
+        documentId,
+        companyName,
+        title,
+        name,
+        nameAddressed,
+        emailAddress: sanitizeString(data.email) ?? sanitizeString(data.emailAddress),
+        phone: sanitizeString(data.phone),
+        addressLine1: sanitizeString(data.addressLine1),
+        addressLine2: sanitizeString(data.addressLine2),
+        addressLine3: sanitizeString(data.addressLine3),
+        addressLine4: sanitizeString(data.addressLine4),
+        addressLine5: sanitizeString(data.addressLine5) ?? sanitizeString(data.region),
+        region: sanitizeString(data.region),
+        createdAt,
+        hasOverduePayment: false,
+      }
+    })
+
+    const sorted = records.sort((a, b) => a.companyName.localeCompare(b.companyName))
+    const enriched = sorted.map((record) => {
+      const key =
+        normalizeCompanyKey(record.companyName) ?? normalizeCompanyKey(record.documentId)
+      return {
+        ...record,
+        hasOverduePayment: key ? overdueCompanies.has(key) : false,
+      }
+    })
+
+    console.info('[client-directory] Successfully fetched clients', {
+      count: enriched.length,
+      overdueCompanies: overdueCompanies.size,
+    })
+
+    return enriched
+  } catch (error) {
+    const diagnostics = getFirebaseDiagnosticsSnapshot()
+    console.error('[client-directory] Failed to fetch clients', {
+      error:
+        error instanceof Error
+          ? { message: error.message, stack: error.stack }
+          : { message: 'Unknown error', raw: error },
+      firebase: diagnostics,
+    })
+    throw error
+  }
 }
 
 export interface ClientDirectoryWriteInput {
diff --git a/lib/firebase.ts b/lib/firebase.ts
index 35c04e9..00a62d1 100644
--- a/lib/firebase.ts
+++ b/lib/firebase.ts
@@ -1,31 +1,129 @@
 // lib/firebase.ts
 
-import { initializeApp, getApps, getApp } from 'firebase/app'
+import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app'
 import { getFirestore } from 'firebase/firestore'
 
-const firebaseConfig = {
-  apiKey:               process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
-  authDomain:           process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
-  projectId:            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
-  storageBucket:        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
-  messagingSenderId:    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
-  appId:                process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
+const firebaseEnvConfig = {
+  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
+  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
+  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
+  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
+  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
+  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
 }
 
-console.log('🔥 Firebase config:', firebaseConfig)
-Object.entries(firebaseConfig).forEach(([k, v]) => {
-  console.log(`   ${k}: ${v}`)
-})
-
 const DEFAULT_DATABASE_ID = 'mel-sessions'
 const PROJECTS_DATABASE_ID = 'epl-projects'
 
-console.log('📚 Firestore database ID:', DEFAULT_DATABASE_ID)
-console.log('📚 Firestore projects database ID:', PROJECTS_DATABASE_ID)
+type FirebaseEnvSnapshot = {
+  NEXT_PUBLIC_FIREBASE_API_KEY: string | null
+  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string | null
+  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string | null
+  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string | null
+  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string | null
+  NEXT_PUBLIC_FIREBASE_APP_ID: string | null
+}
+
+const maskEnvValue = (value: string | undefined): string | null => {
+  if (!value) return null
+  if (value.length <= 8) {
+    const first = value[0] ?? ''
+    const last = value[value.length - 1] ?? ''
+    return `${first}***${last}`
+  }
+  return `${value.slice(0, 4)}...${value.slice(-4)}`
+}
+
+const buildFirebaseEnvSnapshot = (): FirebaseEnvSnapshot => ({
+  NEXT_PUBLIC_FIREBASE_API_KEY: maskEnvValue(firebaseEnvConfig.apiKey),
+  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: maskEnvValue(firebaseEnvConfig.authDomain),
+  NEXT_PUBLIC_FIREBASE_PROJECT_ID: maskEnvValue(firebaseEnvConfig.projectId),
+  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: maskEnvValue(firebaseEnvConfig.storageBucket),
+  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: maskEnvValue(firebaseEnvConfig.messagingSenderId),
+  NEXT_PUBLIC_FIREBASE_APP_ID: maskEnvValue(firebaseEnvConfig.appId),
+})
+
+export const getFirebaseDiagnosticsSnapshot = () => ({
+  env: buildFirebaseEnvSnapshot(),
+  hasInitializedApp: getApps().length > 0,
+  databaseIds: {
+    default: DEFAULT_DATABASE_ID,
+    projects: PROJECTS_DATABASE_ID,
+  },
+})
+
+const resolveFirebaseConfig = (): FirebaseOptions => {
+  const missingKeys = Object.entries(firebaseEnvConfig)
+    .filter(([, value]) => {
+      if (typeof value !== 'string') {
+        return true
+      }
+      return value.trim().length === 0
+    })
+    .map(([key]) => key)
+
+  if (missingKeys.length > 0) {
+    const diagnostics = getFirebaseDiagnosticsSnapshot()
+    console.error('[firebase] Missing Firebase configuration', {
+      missingKeys,
+      diagnostics,
+    })
+    throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`)
+  }
+
+  return {
+    apiKey: firebaseEnvConfig.apiKey as string,
+    authDomain: firebaseEnvConfig.authDomain as string,
+    projectId: firebaseEnvConfig.projectId as string,
+    storageBucket: firebaseEnvConfig.storageBucket as string,
+    messagingSenderId: firebaseEnvConfig.messagingSenderId as string,
+    appId: firebaseEnvConfig.appId as string,
+  }
+}
+
+declare global {
+  // eslint-disable-next-line no-var
+  var __AOTE_LOGGED_FIREBASE_SNAPSHOT__: boolean | undefined
+}
+
+if (typeof window === 'undefined' && !globalThis.__AOTE_LOGGED_FIREBASE_SNAPSHOT__) {
+  globalThis.__AOTE_LOGGED_FIREBASE_SNAPSHOT__ = true
+  const snapshot = getFirebaseDiagnosticsSnapshot()
+  console.info('[firebase] Configuration snapshot', snapshot)
+  const missingKeys = Object.entries(snapshot.env)
+    .filter(([, value]) => value === null)
+    .map(([key]) => key)
+
+  if (missingKeys.length > 0) {
+    console.error('[firebase] Missing required environment variables', missingKeys)
+  }
+}
+
+const createFirebaseApp = () => {
+  try {
+    const config = resolveFirebaseConfig()
+
+    if (!getApps().length) {
+      console.info('[firebase] Initializing Firebase app', {
+        projectId: config.projectId,
+      })
+      return initializeApp(config)
+    }
+
+    return getApp()
+  } catch (error) {
+    console.error('[firebase] Failed to initialize Firebase app', {
+      error:
+        error instanceof Error
+          ? { message: error.message, stack: error.stack }
+          : { message: 'Unknown error', raw: error },
+      diagnostics: getFirebaseDiagnosticsSnapshot(),
+    })
+    throw error
+  }
+}
 
-export const app = !getApps().length
-  ? initializeApp(firebaseConfig)
-  : getApp()
+export const app = createFirebaseApp()
 export const db = getFirestore(app, DEFAULT_DATABASE_ID)
 export const projectsDb = getFirestore(app, PROJECTS_DATABASE_ID)
 export const PROJECTS_FIRESTORE_DATABASE_ID = PROJECTS_DATABASE_ID
diff --git a/next.config.ts b/next.config.ts
index 1571804..0803830 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -1,7 +1,50 @@
-module.exports = {
+import path from "path";
+import type { NextConfig } from "next";
+
+const CLASSNAMES_FRAGMENT = "/antd/node_modules/classnames/index.js";
+
+const config: NextConfig = {
   eslint: {
     // Warning: This allows production builds to successfully complete even if
     // your project has ESLint errors.
     ignoreDuringBuilds: true,
   },
+  transpilePackages: [
+    "@refinedev/antd",
+    "@refinedev/core",
+    "@refinedev/nextjs-router",
+    "@ant-design/icons",
+    "antd",
+    "rc-util",
+    "rc-picker",
+    "rc-table",
+    "rc-tree",
+    "rc-pagination",
+    "rc-menu",
+    "rc-tabs",
+    "rc-select",
+    "rc-dropdown",
+  ],
+  webpack: (webpackConfig) => {
+    webpackConfig.module = webpackConfig.module ?? {};
+    webpackConfig.module.parser = webpackConfig.module.parser ?? {};
+    webpackConfig.module.parser.javascript = {
+      ...webpackConfig.module.parser.javascript,
+      importMeta: true,
+    };
+    webpackConfig.module.rules = webpackConfig.module.rules ?? [];
+    webpackConfig.module.rules.push({
+      test: (resource: string) =>
+        resource.replace(/\\/g, "/").endsWith(CLASSNAMES_FRAGMENT),
+      enforce: "post",
+      use: [
+        {
+          loader: path.resolve(__dirname, "scripts/replaceImportMetaLoader.js"),
+        },
+      ],
+    });
+    return webpackConfig;
+  },
 };
+
+export default config;
diff --git a/package-lock.json b/package-lock.json
index 24eb425..272040c 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -9,14 +9,17 @@
       "version": "1.0.0",
       "license": "ISC",
       "dependencies": {
+        "@ant-design/icons": "^5.5.3",
         "@emotion/react": "^11.14.0",
         "@emotion/styled": "^11.14.0",
         "@google-cloud/secret-manager": "^5.6.0",
         "@mui/icons-material": "^6.3.1",
         "@mui/material": "^6.4.7",
+        "@refinedev/antd": "^6.0.2",
         "@refinedev/core": "^5.0.4",
         "@refinedev/nextjs-router": "^7.0.1",
         "@tanstack/react-query": "^5.59.15",
+        "antd": "^5.23.0",
         "browserify-zlib": "^0.2.0",
         "date-fns": "^4.1.0",
         "dayjs": "^1.11.10",
@@ -25,6 +28,7 @@
         "google-auth-library": "^9.15.0",
         "googleapis": "^144.0.0",
         "jwt-decode": "^4.0.0",
+        "lodash.debounce": "^4.0.8",
         "next": "^15.2.1",
         "next-auth": "^4.24.10",
         "notistack": "^3.0.1",
@@ -46,6 +50,7 @@
         "@testing-library/react": "^16.1.0",
         "@types/cypress": "^0.1.6",
         "@types/jest": "^30.0.0",
+        "@types/lodash.debounce": "^4.0.9",
         "@types/node": "^22.10.2",
         "@types/react": "^18.3.16",
         "@types/react-dom": "^18.3.2",
@@ -88,6 +93,203 @@
         "node": ">=6.0.0"
       }
     },
+    "node_modules/@ant-design/colors": {
+      "version": "7.2.1",
+      "resolved": "https://registry.npmjs.org/@ant-design/colors/-/colors-7.2.1.tgz",
+      "integrity": "sha512-lCHDcEzieu4GA3n8ELeZ5VQ8pKQAWcGGLRTQ50aQM2iqPpq2evTxER84jfdPvsPAtEcZ7m44NI45edFMo8oOYQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/fast-color": "^2.0.6"
+      }
+    },
+    "node_modules/@ant-design/cssinjs": {
+      "version": "1.24.0",
+      "resolved": "https://registry.npmjs.org/@ant-design/cssinjs/-/cssinjs-1.24.0.tgz",
+      "integrity": "sha512-K4cYrJBsgvL+IoozUXYjbT6LHHNt+19a9zkvpBPxLjFHas1UpPM2A5MlhROb0BT8N8WoavM5VsP9MeSeNK/3mg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "@emotion/hash": "^0.8.0",
+        "@emotion/unitless": "^0.7.5",
+        "classnames": "^2.3.1",
+        "csstype": "^3.1.3",
+        "rc-util": "^5.35.0",
+        "stylis": "^4.3.4"
+      },
+      "peerDependencies": {
+        "react": ">=16.0.0",
+        "react-dom": ">=16.0.0"
+      }
+    },
+    "node_modules/@ant-design/cssinjs-utils": {
+      "version": "1.1.3",
+      "resolved": "https://registry.npmjs.org/@ant-design/cssinjs-utils/-/cssinjs-utils-1.1.3.tgz",
+      "integrity": "sha512-nOoQMLW1l+xR1Co8NFVYiP8pZp3VjIIzqV6D6ShYF2ljtdwWJn5WSsH+7kvCktXL/yhEtWURKOfH5Xz/gzlwsg==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/cssinjs": "^1.21.0",
+        "@babel/runtime": "^7.23.2",
+        "rc-util": "^5.38.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@ant-design/cssinjs/node_modules/@emotion/hash": {
+      "version": "0.8.0",
+      "resolved": "https://registry.npmjs.org/@emotion/hash/-/hash-0.8.0.tgz",
+      "integrity": "sha512-kBJtf7PH6aWwZ6fka3zQ0p6SBYzx4fl1LoZXE2RrnYST9Xljm7WfKJrU4g/Xr3Beg72MLrp1AWNUmuYJTL7Cow==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/cssinjs/node_modules/@emotion/unitless": {
+      "version": "0.7.5",
+      "resolved": "https://registry.npmjs.org/@emotion/unitless/-/unitless-0.7.5.tgz",
+      "integrity": "sha512-OWORNpfjMsSSUBVrRBVGECkhWcULOAJz9ZW8uK9qgxD+87M7jHRcvh/A96XXNhXTLmKcoYSQtBEX7lHMO7YRwg==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/cssinjs/node_modules/stylis": {
+      "version": "4.3.6",
+      "resolved": "https://registry.npmjs.org/stylis/-/stylis-4.3.6.tgz",
+      "integrity": "sha512-yQ3rwFWRfwNUY7H5vpU0wfdkNSnvnJinhF9830Swlaxl03zsOjCfmX0ugac+3LtK0lYSgwL/KXc8oYL3mG4YFQ==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/fast-color": {
+      "version": "2.0.6",
+      "resolved": "https://registry.npmjs.org/@ant-design/fast-color/-/fast-color-2.0.6.tgz",
+      "integrity": "sha512-y2217gk4NqL35giHl72o6Zzqji9O7vHh9YmhUVkPtAOpoTCH4uWxo/pr4VE8t0+ChEPs0qo4eJRC5Q1eXWo3vA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.7"
+      },
+      "engines": {
+        "node": ">=8.x"
+      }
+    },
+    "node_modules/@ant-design/icons": {
+      "version": "5.6.1",
+      "resolved": "https://registry.npmjs.org/@ant-design/icons/-/icons-5.6.1.tgz",
+      "integrity": "sha512-0/xS39c91WjPAZOWsvi1//zjx6kAp4kxWwctR6kuU6p133w8RU0D2dSCvZC19uQyharg/sAvYxGYWl01BbZZfg==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/colors": "^7.0.0",
+        "@ant-design/icons-svg": "^4.4.0",
+        "@babel/runtime": "^7.24.8",
+        "classnames": "^2.2.6",
+        "rc-util": "^5.31.1"
+      },
+      "engines": {
+        "node": ">=8"
+      },
+      "peerDependencies": {
+        "react": ">=16.0.0",
+        "react-dom": ">=16.0.0"
+      }
+    },
+    "node_modules/@ant-design/icons-svg": {
+      "version": "4.4.2",
+      "resolved": "https://registry.npmjs.org/@ant-design/icons-svg/-/icons-svg-4.4.2.tgz",
+      "integrity": "sha512-vHbT+zJEVzllwP+CM+ul7reTEfBR0vgxFe7+lREAsAA7YGsYpboiq2sQNeQeRvh09GfQgs/GyFEvZpJ9cLXpXA==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/pro-layout": {
+      "version": "7.22.7",
+      "resolved": "https://registry.npmjs.org/@ant-design/pro-layout/-/pro-layout-7.22.7.tgz",
+      "integrity": "sha512-fvmtNA1r9SaasVIQIQt611VSlNxtVxDbQ3e+1GhYQza3tVJi/3gCZuDyfMfTnbLmf3PaW/YvLkn7MqDbzAzoLA==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/cssinjs": "^1.21.1",
+        "@ant-design/icons": "^5.0.0",
+        "@ant-design/pro-provider": "2.16.2",
+        "@ant-design/pro-utils": "2.18.0",
+        "@babel/runtime": "^7.18.0",
+        "@umijs/route-utils": "^4.0.0",
+        "@umijs/use-params": "^1.0.9",
+        "classnames": "^2.3.2",
+        "lodash": "^4.17.21",
+        "lodash-es": "^4.17.21",
+        "path-to-regexp": "8.2.0",
+        "rc-resize-observer": "^1.1.0",
+        "rc-util": "^5.0.6",
+        "swr": "^2.0.0",
+        "warning": "^4.0.3"
+      },
+      "peerDependencies": {
+        "antd": "^4.24.15 || ^5.11.2",
+        "react": ">=17.0.0",
+        "react-dom": ">=17.0.0"
+      }
+    },
+    "node_modules/@ant-design/pro-layout/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/pro-provider": {
+      "version": "2.16.2",
+      "resolved": "https://registry.npmjs.org/@ant-design/pro-provider/-/pro-provider-2.16.2.tgz",
+      "integrity": "sha512-0KmCH1EaOND787Jz6VRMYtLNZmqfT0JPjdUfxhyOxFfnBRfrjyfZgIa6CQoAJLEUMWv57PccWS8wRHVUUk2Yiw==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/cssinjs": "^1.21.1",
+        "@babel/runtime": "^7.18.0",
+        "@ctrl/tinycolor": "^3.4.0",
+        "dayjs": "^1.11.10",
+        "rc-util": "^5.0.1",
+        "swr": "^2.0.0"
+      },
+      "peerDependencies": {
+        "antd": "^4.24.15 || ^5.11.2",
+        "react": ">=17.0.0",
+        "react-dom": ">=17.0.0"
+      }
+    },
+    "node_modules/@ant-design/pro-utils": {
+      "version": "2.18.0",
+      "resolved": "https://registry.npmjs.org/@ant-design/pro-utils/-/pro-utils-2.18.0.tgz",
+      "integrity": "sha512-8+ikyrN8L8a8Ph4oeHTOJEiranTj18+9+WHCHjKNdEfukI7Rjn8xpYdLJWb2AUJkb9d4eoAqjd5+k+7w81Df0w==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/icons": "^5.0.0",
+        "@ant-design/pro-provider": "2.16.2",
+        "@babel/runtime": "^7.18.0",
+        "classnames": "^2.3.2",
+        "dayjs": "^1.11.10",
+        "lodash": "^4.17.21",
+        "lodash-es": "^4.17.21",
+        "rc-util": "^5.0.6",
+        "safe-stable-stringify": "^2.4.3",
+        "swr": "^2.0.0"
+      },
+      "peerDependencies": {
+        "antd": "^4.24.15 || ^5.11.2",
+        "react": ">=17.0.0",
+        "react-dom": ">=17.0.0"
+      }
+    },
+    "node_modules/@ant-design/pro-utils/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/react-slick": {
+      "version": "1.1.2",
+      "resolved": "https://registry.npmjs.org/@ant-design/react-slick/-/react-slick-1.1.2.tgz",
+      "integrity": "sha512-EzlvzE6xQUBrZuuhSAFTdsr4P2bBBHGZwKFemEfq8gIGyIQCxalYfZW/T2ORbtQx5rU69o+WycP3exY/7T1hGA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.4",
+        "classnames": "^2.2.5",
+        "json2mq": "^0.2.0",
+        "resize-observer-polyfill": "^1.5.1",
+        "throttle-debounce": "^5.0.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0"
+      }
+    },
     "node_modules/@asamuzakjp/css-color": {
       "version": "3.2.0",
       "resolved": "https://registry.npmjs.org/@asamuzakjp/css-color/-/css-color-3.2.0.tgz",
@@ -770,6 +972,15 @@
         "node": ">=18"
       }
     },
+    "node_modules/@ctrl/tinycolor": {
+      "version": "3.6.1",
+      "resolved": "https://registry.npmjs.org/@ctrl/tinycolor/-/tinycolor-3.6.1.tgz",
+      "integrity": "sha512-SITSV6aIXsuVNV3f3O0f2n/cgyEDWoSqtZMYiAmcsYHydcKrOz3gUxB/iXd/Qf08+IZX4KpgNbvUdMBmWz+kcA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=10"
+      }
+    },
     "node_modules/@emnapi/runtime": {
       "version": "1.4.3",
       "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.4.3.tgz",
@@ -3974,6 +4185,214 @@
       "integrity": "sha512-Vvn3zZrhQZkkBE8LSuW3em98c0FwgO4nxzv6OdSxPKJIEKY2bGbHn+mhGIPerzI4twdxaP8/0+06HBpwf345Lw==",
       "license": "BSD-3-Clause"
     },
+    "node_modules/@rc-component/async-validator": {
+      "version": "5.0.4",
+      "resolved": "https://registry.npmjs.org/@rc-component/async-validator/-/async-validator-5.0.4.tgz",
+      "integrity": "sha512-qgGdcVIF604M9EqjNF0hbUTz42bz/RDtxWdWuU5EQe3hi7M8ob54B6B35rOsvX5eSvIHIzT9iH1R3n+hk3CGfg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.4"
+      },
+      "engines": {
+        "node": ">=14.x"
+      }
+    },
+    "node_modules/@rc-component/color-picker": {
+      "version": "2.0.1",
+      "resolved": "https://registry.npmjs.org/@rc-component/color-picker/-/color-picker-2.0.1.tgz",
+      "integrity": "sha512-WcZYwAThV/b2GISQ8F+7650r5ZZJ043E57aVBFkQ+kSY4C6wdofXgB0hBx+GPGpIU0Z81eETNoDUJMr7oy/P8Q==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/fast-color": "^2.0.6",
+        "@babel/runtime": "^7.23.6",
+        "classnames": "^2.2.6",
+        "rc-util": "^5.38.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/context": {
+      "version": "1.4.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/context/-/context-1.4.0.tgz",
+      "integrity": "sha512-kFcNxg9oLRMoL3qki0OMxK+7g5mypjgaaJp/pkOis/6rVxma9nJBF/8kCIuTYHUQNr0ii7MxqE33wirPZLJQ2w==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "rc-util": "^5.27.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/mini-decimal": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/mini-decimal/-/mini-decimal-1.1.0.tgz",
+      "integrity": "sha512-jS4E7T9Li2GuYwI6PyiVXmxTiM6b07rlD9Ge8uGZSCz3WlzcG5ZK7g5bbuKNeZ9pgUuPK/5guV781ujdVpm4HQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0"
+      },
+      "engines": {
+        "node": ">=8.x"
+      }
+    },
+    "node_modules/@rc-component/mutate-observer": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/mutate-observer/-/mutate-observer-1.1.0.tgz",
+      "integrity": "sha512-QjrOsDXQusNwGZPf4/qRQasg7UFEj06XiCJ8iuiq/Io7CrHrgVi6Uuetw60WAMG1799v+aM8kyc+1L/GBbHSlw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.24.4"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/mutate-observer/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/portal": {
+      "version": "1.1.2",
+      "resolved": "https://registry.npmjs.org/@rc-component/portal/-/portal-1.1.2.tgz",
+      "integrity": "sha512-6f813C0IsasTZms08kfA8kPAGxbbkYToa8ALaiDIGGECU4i9hj8Plgbx0sNJDrey3EtHO30hmdaxtT0138xZcg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.24.4"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/portal/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/qrcode": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@rc-component/qrcode/-/qrcode-1.0.1.tgz",
+      "integrity": "sha512-g8eeeaMyFXVlq8cZUeaxCDhfIYjpao0l9cvm5gFwKXy/Vm1yDWV7h2sjH5jHYzdFedlVKBpATFB1VKMrHzwaWQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.7",
+        "classnames": "^2.3.2"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/qrcode/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/tour": {
+      "version": "1.15.1",
+      "resolved": "https://registry.npmjs.org/@rc-component/tour/-/tour-1.15.1.tgz",
+      "integrity": "sha512-Tr2t7J1DKZUpfJuDZWHxyxWpfmj8EZrqSgyMZ+BCdvKZ6r1UDsfU46M/iWAAFBy961Ssfom2kv5f3UcjIL2CmQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "@rc-component/portal": "^1.0.0-9",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.24.4"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/tour/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/trigger": {
+      "version": "2.3.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/trigger/-/trigger-2.3.0.tgz",
+      "integrity": "sha512-iwaxZyzOuK0D7lS+0AQEtW52zUWxoGqTGkke3dRyb8pYiShmRpCjB/8TzPI4R6YySCH7Vm9BZj/31VPiiQTLBg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.23.2",
+        "@rc-component/portal": "^1.1.0",
+        "classnames": "^2.3.2",
+        "rc-motion": "^2.0.0",
+        "rc-resize-observer": "^1.3.1",
+        "rc-util": "^5.44.0"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/trigger/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@refinedev/antd": {
+      "version": "6.0.2",
+      "resolved": "https://registry.npmjs.org/@refinedev/antd/-/antd-6.0.2.tgz",
+      "integrity": "sha512-Z9UocvTrKG9+9wWArdBk3t0FTXuvQxhg7BukkjnBchIcV8zrYvDPGTjszpFN0xl1TXpZKoHY2psuITLdY7QmhA==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/icons": "^5.5.1",
+        "@ant-design/pro-layout": "^7.21.1",
+        "@refinedev/ui-types": "^2.0.0",
+        "@tanstack/react-query": "^5.81.5",
+        "antd": "^5.23.0",
+        "dayjs": "^1.10.7",
+        "react-markdown": "^6.0.1",
+        "remark-gfm": "^1.0.0",
+        "sunflower-antd": "1.0.0-beta.3",
+        "tslib": "^2.6.2"
+      },
+      "engines": {
+        "node": ">=20"
+      },
+      "peerDependencies": {
+        "@refinedev/core": "^5.0.0",
+        "@types/react": "^18.0.0 || ^19.0.0",
+        "@types/react-dom": "^18.0.0 || ^19.0.0",
+        "antd": "^5.23.0",
+        "dayjs": "^1.10.7",
+        "react": "^18.0.0 || ^19.0.0",
+        "react-dom": "^18.0.0 || ^19.0.0"
+      }
+    },
     "node_modules/@refinedev/core": {
       "version": "5.0.4",
       "resolved": "https://registry.npmjs.org/@refinedev/core/-/core-5.0.4.tgz",
@@ -4061,6 +4480,25 @@
         "react-dom": "^18.0.0 || ^19.0.0"
       }
     },
+    "node_modules/@refinedev/ui-types": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/@refinedev/ui-types/-/ui-types-2.0.0.tgz",
+      "integrity": "sha512-ymkx/dn2pJtB1PQiGVXdC5CfmEM1hjd5Vj0JEqzYRAVRcDnv37kDViBHnO7h2Lydw7FDZAglCkt9kRMEbad6xA==",
+      "license": "MIT",
+      "dependencies": {
+        "@refinedev/core": "^5.0.0",
+        "dayjs": "^1.10.7",
+        "tslib": "^2.6.2"
+      },
+      "engines": {
+        "node": ">=20"
+      },
+      "peerDependencies": {
+        "@refinedev/core": "^5.0.0",
+        "react": "^18.0.0 || ^19.0.0",
+        "react-dom": "^18.0.0 || ^19.0.0"
+      }
+    },
     "node_modules/@sinclair/typebox": {
       "version": "0.27.8",
       "resolved": "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.27.8.tgz",
@@ -4387,6 +4825,15 @@
         "@types/node": "*"
       }
     },
+    "node_modules/@types/hast": {
+      "version": "2.3.10",
+      "resolved": "https://registry.npmjs.org/@types/hast/-/hast-2.3.10.tgz",
+      "integrity": "sha512-McWspRw8xx8J9HurkVBfYj0xKoE25tOFlHGdx4MJ5xORQrMGZNqJhVQWaIbm6Oyla5kYOXtDiopzKRJzEOkwJw==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2"
+      }
+    },
     "node_modules/@types/http-errors": {
       "version": "2.0.5",
       "resolved": "https://registry.npmjs.org/@types/http-errors/-/http-errors-2.0.5.tgz",
@@ -4680,6 +5127,23 @@
       "license": "MIT",
       "optional": true
     },
+    "node_modules/@types/lodash": {
+      "version": "4.17.20",
+      "resolved": "https://registry.npmjs.org/@types/lodash/-/lodash-4.17.20.tgz",
+      "integrity": "sha512-H3MHACvFUEiujabxhaI/ImO6gUrd8oOurg7LQtS7mbwIXA/cUqWrvBsaeJ23aZEPk1TAYkurjfMbSELfoCXlGA==",
+      "dev": true,
+      "license": "MIT"
+    },
+    "node_modules/@types/lodash.debounce": {
+      "version": "4.0.9",
+      "resolved": "https://registry.npmjs.org/@types/lodash.debounce/-/lodash.debounce-4.0.9.tgz",
+      "integrity": "sha512-Ma5JcgTREwpLRwMM+XwBR7DaWe96nC38uCBDFKZWbNKD+osjVzdpnUSwBcqCptrp16sSOLBAUb50Car5I0TCsQ==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@types/lodash": "*"
+      }
+    },
     "node_modules/@types/long": {
       "version": "4.0.2",
       "resolved": "https://registry.npmjs.org/@types/long/-/long-4.0.2.tgz",
@@ -4697,6 +5161,15 @@
         "@types/mdurl": "^2"
       }
     },
+    "node_modules/@types/mdast": {
+      "version": "3.0.15",
+      "resolved": "https://registry.npmjs.org/@types/mdast/-/mdast-3.0.15.tgz",
+      "integrity": "sha512-LnwD+mUEfxWMa1QpDraczIn6k0Ee3SMicuYSSzS6ZYl2gKS09EClnJYGd8Du6rfc5r/GZEk5o1mRb8TaTj03sQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2"
+      }
+    },
     "node_modules/@types/mdurl": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/@types/mdurl/-/mdurl-2.0.0.tgz",
@@ -4857,6 +5330,12 @@
       "integrity": "sha512-/Ad8+nIOV7Rl++6f1BdKxFSMgmoqEoYbHRpPcx3JEfv8VRsQe9Z4mCXeJBzxs7mbHY/XOZZuXlRNfhpVPbs6ZA==",
       "license": "MIT"
     },
+    "node_modules/@types/unist": {
+      "version": "2.0.11",
+      "resolved": "https://registry.npmjs.org/@types/unist/-/unist-2.0.11.tgz",
+      "integrity": "sha512-CmBKiL6NNo/OqgmMn95Fk9Whlp2mtvIv+KNpQKN2F4SjvrEesubTRWGYSg+BnWZOnlCaSTU1sMpsBOzgbYhnsA==",
+      "license": "MIT"
+    },
     "node_modules/@types/yargs": {
       "version": "17.0.33",
       "resolved": "https://registry.npmjs.org/@types/yargs/-/yargs-17.0.33.tgz",
@@ -5119,6 +5598,21 @@
         "url": "https://opencollective.com/eslint"
       }
     },
+    "node_modules/@umijs/route-utils": {
+      "version": "4.0.1",
+      "resolved": "https://registry.npmjs.org/@umijs/route-utils/-/route-utils-4.0.1.tgz",
+      "integrity": "sha512-+1ixf1BTOLuH+ORb4x8vYMPeIt38n9q0fJDwhv9nSxrV46mxbLF0nmELIo9CKQB2gHfuC4+hww6xejJ6VYnBHQ==",
+      "license": "MIT"
+    },
+    "node_modules/@umijs/use-params": {
+      "version": "1.0.9",
+      "resolved": "https://registry.npmjs.org/@umijs/use-params/-/use-params-1.0.9.tgz",
+      "integrity": "sha512-QlN0RJSBVQBwLRNxbxjQ5qzqYIGn+K7USppMoIOVlf7fxXHsnQZ2bEsa6Pm74bt6DVQxpUE8HqvdStn6Y9FV1w==",
+      "license": "MIT",
+      "peerDependencies": {
+        "react": "*"
+      }
+    },
     "node_modules/@ungap/structured-clone": {
       "version": "1.3.0",
       "resolved": "https://registry.npmjs.org/@ungap/structured-clone/-/structured-clone-1.3.0.tgz",
@@ -5240,6 +5734,77 @@
         "url": "https://github.com/chalk/ansi-styles?sponsor=1"
       }
     },
+    "node_modules/antd": {
+      "version": "5.27.4",
+      "resolved": "https://registry.npmjs.org/antd/-/antd-5.27.4.tgz",
+      "integrity": "sha512-rhArohoAUCxhkPjGI/BXthOrrjaElL4Fb7d4vEHnIR3DpxFXfegd4rN21IgGdiF+Iz4EFuUZu8MdS8NuJHLSVQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/colors": "^7.2.1",
+        "@ant-design/cssinjs": "^1.23.0",
+        "@ant-design/cssinjs-utils": "^1.1.3",
+        "@ant-design/fast-color": "^2.0.6",
+        "@ant-design/icons": "^5.6.1",
+        "@ant-design/react-slick": "~1.1.2",
+        "@babel/runtime": "^7.26.0",
+        "@rc-component/color-picker": "~2.0.1",
+        "@rc-component/mutate-observer": "^1.1.0",
+        "@rc-component/qrcode": "~1.0.0",
+        "@rc-component/tour": "~1.15.1",
+        "@rc-component/trigger": "^2.3.0",
+        "classnames": "^2.5.1",
+        "copy-to-clipboard": "^3.3.3",
+        "dayjs": "^1.11.11",
+        "rc-cascader": "~3.34.0",
+        "rc-checkbox": "~3.5.0",
+        "rc-collapse": "~3.9.0",
+        "rc-dialog": "~9.6.0",
+        "rc-drawer": "~7.3.0",
+        "rc-dropdown": "~4.2.1",
+        "rc-field-form": "~2.7.0",
+        "rc-image": "~7.12.0",
+        "rc-input": "~1.8.0",
+        "rc-input-number": "~9.5.0",
+        "rc-mentions": "~2.20.0",
+        "rc-menu": "~9.16.1",
+        "rc-motion": "^2.9.5",
+        "rc-notification": "~5.6.4",
+        "rc-pagination": "~5.1.0",
+        "rc-picker": "~4.11.3",
+        "rc-progress": "~4.0.0",
+        "rc-rate": "~2.13.1",
+        "rc-resize-observer": "^1.4.3",
+        "rc-segmented": "~2.7.0",
+        "rc-select": "~14.16.8",
+        "rc-slider": "~11.1.9",
+        "rc-steps": "~6.0.1",
+        "rc-switch": "~4.1.0",
+        "rc-table": "~7.53.0",
+        "rc-tabs": "~15.7.0",
+        "rc-textarea": "~1.10.2",
+        "rc-tooltip": "~6.4.0",
+        "rc-tree": "~5.13.1",
+        "rc-tree-select": "~5.27.0",
+        "rc-upload": "~4.9.2",
+        "rc-util": "^5.44.4",
+        "scroll-into-view-if-needed": "^3.1.0",
+        "throttle-debounce": "^5.0.2"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/ant-design"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/antd/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
     "node_modules/anymatch": {
       "version": "3.1.3",
       "resolved": "https://registry.npmjs.org/anymatch/-/anymatch-3.1.3.tgz",
@@ -5607,6 +6172,16 @@
         "@babel/core": "^7.0.0"
       }
     },
+    "node_modules/bail": {
+      "version": "1.0.5",
+      "resolved": "https://registry.npmjs.org/bail/-/bail-1.0.5.tgz",
+      "integrity": "sha512-xFbRxM1tahm08yHBP16MMjVUAvDaBMD38zsM9EMAUN61omwLmKlOpB/Zku5QkjZ8TZ4vn53pj+t518cH0S03RQ==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/balanced-match": {
       "version": "1.0.2",
       "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz",
@@ -5862,10 +6437,20 @@
         "node": ">= 10"
       }
     },
-    "node_modules/chalk": {
-      "version": "4.1.2",
-      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
-      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
+    "node_modules/ccount": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/ccount/-/ccount-1.1.0.tgz",
+      "integrity": "sha512-vlNK021QdI7PNeiUh/lKkC/mNHHfV0m/Ad5JoI0TYtlBnJAslM/JIkm/tGC88bkLIwO6OQ5uV6ztS6kVAtCDlg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/chalk": {
+      "version": "4.1.2",
+      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
+      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
       "devOptional": true,
       "license": "MIT",
       "dependencies": {
@@ -5889,6 +6474,36 @@
         "node": ">=10"
       }
     },
+    "node_modules/character-entities": {
+      "version": "1.2.4",
+      "resolved": "https://registry.npmjs.org/character-entities/-/character-entities-1.2.4.tgz",
+      "integrity": "sha512-iBMyeEHxfVnIakwOuDXpVkc54HijNgCyQB2w0VfGQThle6NXn50zU6V/u+LDhxHcDUPojn6Kpga3PTAD8W1bQw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/character-entities-legacy": {
+      "version": "1.1.4",
+      "resolved": "https://registry.npmjs.org/character-entities-legacy/-/character-entities-legacy-1.1.4.tgz",
+      "integrity": "sha512-3Xnr+7ZFS1uxeiUDvV02wQ+QDbc55o97tIV5zHScSPJpcLm/r0DFPcoY3tYRp+VZukxuMeKgXYmsXQHO05zQeA==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/character-reference-invalid": {
+      "version": "1.1.4",
+      "resolved": "https://registry.npmjs.org/character-reference-invalid/-/character-reference-invalid-1.1.4.tgz",
+      "integrity": "sha512-mKKUkUbhPpQlCOfIuZkvSEgktjPFIsZKRRbC6KWVEMvlzblj3i3asQv5ODsrwt0N3pHAEvjP8KTQPHkp0+6jOg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/ci-info": {
       "version": "3.9.0",
       "resolved": "https://registry.npmjs.org/ci-info/-/ci-info-3.9.0.tgz",
@@ -6020,6 +6635,16 @@
         "node": ">= 0.8"
       }
     },
+    "node_modules/comma-separated-tokens": {
+      "version": "1.0.8",
+      "resolved": "https://registry.npmjs.org/comma-separated-tokens/-/comma-separated-tokens-1.0.8.tgz",
+      "integrity": "sha512-GHuDRO12Sypu2cV70d1dkA2EUmXHgntrzbpvOB+Qy+49ypNfGgFQIC2fhhXbnyrJRynDCAARsT7Ou0M6hirpfw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/compressible": {
       "version": "2.0.18",
       "resolved": "https://registry.npmjs.org/compressible/-/compressible-2.0.18.tgz",
@@ -6033,6 +6658,12 @@
         "node": ">= 0.6"
       }
     },
+    "node_modules/compute-scroll-into-view": {
+      "version": "3.1.1",
+      "resolved": "https://registry.npmjs.org/compute-scroll-into-view/-/compute-scroll-into-view-3.1.1.tgz",
+      "integrity": "sha512-VRhuHOLoKYOy4UbilLbUzbYg93XLjv2PncJC50EuTWPA3gaja1UjBsUP/D/9/juV3vQFr6XBEzn9KCAHdUvOHw==",
+      "license": "MIT"
+    },
     "node_modules/concat-map": {
       "version": "0.0.1",
       "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
@@ -6055,6 +6686,15 @@
         "node": ">= 0.6"
       }
     },
+    "node_modules/copy-to-clipboard": {
+      "version": "3.3.3",
+      "resolved": "https://registry.npmjs.org/copy-to-clipboard/-/copy-to-clipboard-3.3.3.tgz",
+      "integrity": "sha512-2KV8NhB5JqC3ky0r9PMCAZKbUHSwtEo4CwCs0KXgruG43gX5PMqDEBbVU4OUzw2MuAWUfsuFmWvEKG5QRfSnJA==",
+      "license": "MIT",
+      "dependencies": {
+        "toggle-selection": "^1.0.6"
+      }
+    },
     "node_modules/cosmiconfig": {
       "version": "7.1.0",
       "resolved": "https://registry.npmjs.org/cosmiconfig/-/cosmiconfig-7.1.0.tgz",
@@ -6331,7 +6971,6 @@
       "version": "2.0.3",
       "resolved": "https://registry.npmjs.org/dequal/-/dequal-2.0.3.tgz",
       "integrity": "sha512-0je+qPKHEMohvfRTCEo3CrPG6cAzAYgmzKyxRiYSSDkS6eGJdyVJm7WaYA5ECaAD9wLB2T4EEeymA5aFVcYXCA==",
-      "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6"
@@ -8403,6 +9042,12 @@
       "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
       "license": "ISC"
     },
+    "node_modules/inline-style-parser": {
+      "version": "0.1.1",
+      "resolved": "https://registry.npmjs.org/inline-style-parser/-/inline-style-parser-0.1.1.tgz",
+      "integrity": "sha512-7NXolsK4CAS5+xvdj5OMMbI962hU/wvwoxk+LWR9Ek9bVtyuuYScDN6eS0rUm6TxApFpw7CX1o4uJzcd4AyD3Q==",
+      "license": "MIT"
+    },
     "node_modules/internal-slot": {
       "version": "1.1.0",
       "resolved": "https://registry.npmjs.org/internal-slot/-/internal-slot-1.1.0.tgz",
@@ -8418,6 +9063,30 @@
         "node": ">= 0.4"
       }
     },
+    "node_modules/is-alphabetical": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-alphabetical/-/is-alphabetical-1.0.4.tgz",
+      "integrity": "sha512-DwzsA04LQ10FHTZuL0/grVDk4rFoVH1pjAToYwBrHSxcrBIGQuXrQMtD5U1b0U2XVgKZCTLLP8u2Qxqhy3l2Vg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/is-alphanumerical": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-alphanumerical/-/is-alphanumerical-1.0.4.tgz",
+      "integrity": "sha512-UzoZUr+XfVz3t3v4KyGEniVL9BDRoQtY7tOyrRybkVNjDFWyo1yhXNGrrBTQxp3ib9BLAWs7k2YKBQsFRkZG9A==",
+      "license": "MIT",
+      "dependencies": {
+        "is-alphabetical": "^1.0.0",
+        "is-decimal": "^1.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/is-array-buffer": {
       "version": "3.0.5",
       "resolved": "https://registry.npmjs.org/is-array-buffer/-/is-array-buffer-3.0.5.tgz",
@@ -8495,6 +9164,29 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/is-buffer": {
+      "version": "2.0.5",
+      "resolved": "https://registry.npmjs.org/is-buffer/-/is-buffer-2.0.5.tgz",
+      "integrity": "sha512-i2R6zNFDwgEHJyQUtJEk0XFi1i0dPFn/oqjK3/vPCcDeJvW5NQ83V8QbicfF1SupOaB0h8ntgBC2YiE7dfyctQ==",
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/feross"
+        },
+        {
+          "type": "patreon",
+          "url": "https://www.patreon.com/feross"
+        },
+        {
+          "type": "consulting",
+          "url": "https://feross.org/support"
+        }
+      ],
+      "license": "MIT",
+      "engines": {
+        "node": ">=4"
+      }
+    },
     "node_modules/is-callable": {
       "version": "1.2.7",
       "resolved": "https://registry.npmjs.org/is-callable/-/is-callable-1.2.7.tgz",
@@ -8558,6 +9250,16 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/is-decimal": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-decimal/-/is-decimal-1.0.4.tgz",
+      "integrity": "sha512-RGdriMmQQvZ2aqaQq3awNA6dCGtKpiDFcOzrTWrDAT2MiWrKQVPmxLGHl7Y2nNu6led0kEyoX0enY0qXYsv9zw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/is-extglob": {
       "version": "2.1.1",
       "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
@@ -8635,6 +9337,16 @@
         "node": ">=0.10.0"
       }
     },
+    "node_modules/is-hexadecimal": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-hexadecimal/-/is-hexadecimal-1.0.4.tgz",
+      "integrity": "sha512-gyPJuv83bHMpocVYoqof5VDiZveEoGoFL8m3BXNb2VW8Xs+rz9kqO8LOQ5DH6EsuvilT1ApazU0pyl+ytbPtlw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/is-map": {
       "version": "2.0.3",
       "resolved": "https://registry.npmjs.org/is-map/-/is-map-2.0.3.tgz",
@@ -8685,6 +9397,15 @@
         "node": ">=8"
       }
     },
+    "node_modules/is-plain-obj": {
+      "version": "2.1.0",
+      "resolved": "https://registry.npmjs.org/is-plain-obj/-/is-plain-obj-2.1.0.tgz",
+      "integrity": "sha512-YWnfyRwxL/+SsrWYfOpUtz5b3YD+nyfkHvjbcanzk8zgyO4ASD67uVMRt8k5bM4lLMDnXfriRhOpemw+NfT1eA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8"
+      }
+    },
     "node_modules/is-potential-custom-element-name": {
       "version": "1.0.1",
       "resolved": "https://registry.npmjs.org/is-potential-custom-element-name/-/is-potential-custom-element-name-1.0.1.tgz",
@@ -10273,6 +10994,15 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/json2mq": {
+      "version": "0.2.0",
+      "resolved": "https://registry.npmjs.org/json2mq/-/json2mq-0.2.0.tgz",
+      "integrity": "sha512-SzoRg7ux5DWTII9J2qkrZrqV1gt+rTaoufMxEzXbS26Uid0NwaJd123HcoB80TgubEppxxIGdNxCx50fEoEWQA==",
+      "license": "MIT",
+      "dependencies": {
+        "string-convert": "^0.2.0"
+      }
+    },
     "node_modules/json5": {
       "version": "2.2.3",
       "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
@@ -10507,6 +11237,12 @@
       "integrity": "sha512-H5ZhCF25riFd9uB5UCkVKo61m3S/xZk1x4wA6yp/L3RFP6Z/eHH1ymQcGLo7J3GMPfm0V/7m1tryHuGVxpqEBQ==",
       "license": "MIT"
     },
+    "node_modules/lodash.debounce": {
+      "version": "4.0.8",
+      "resolved": "https://registry.npmjs.org/lodash.debounce/-/lodash.debounce-4.0.8.tgz",
+      "integrity": "sha512-FT1yDzDYEoYWhnSGnpE/4Kj1fLZkDFyqRb7fNt6FdYOSxlUWAtp42Eh6Wb0rGIv/m9Bgo7x4GhQbm5Ys4SG5ow==",
+      "license": "MIT"
+    },
     "node_modules/lodash.includes": {
       "version": "4.3.0",
       "resolved": "https://registry.npmjs.org/lodash.includes/-/lodash.includes-4.3.0.tgz",
@@ -10569,6 +11305,16 @@
       "integrity": "sha512-ka87Jz3gcx/I7Hal94xaN2tZEOPoUOEVftkQqZx2EeQRN7LGdfLlI3FvZ+7WDplm+vK2Urx9ULrvSowtdCieng==",
       "license": "Apache-2.0"
     },
+    "node_modules/longest-streak": {
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/longest-streak/-/longest-streak-2.0.4.tgz",
+      "integrity": "sha512-vM6rUVCVUJJt33bnmHiZEvr7wPT78ztX7rojL+LW51bHtLh6HTjx84LA5W4+oa6aKEJA7jJu5LR6vQRBpA5DVg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/loose-envify": {
       "version": "1.4.0",
       "resolved": "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz",
@@ -10705,6 +11451,19 @@
         "url": "https://github.com/fb55/entities?sponsor=1"
       }
     },
+    "node_modules/markdown-table": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/markdown-table/-/markdown-table-2.0.0.tgz",
+      "integrity": "sha512-Ezda85ToJUBhM6WGaG6veasyym+Tbs3cMAw/ZhOPqXiYsr0jgocBV3j3nx+4lk47plLlIqjwuTm/ywVI+zjJ/A==",
+      "license": "MIT",
+      "dependencies": {
+        "repeat-string": "^1.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/marked": {
       "version": "4.3.0",
       "resolved": "https://registry.npmjs.org/marked/-/marked-4.3.0.tgz",
@@ -10727,6 +11486,177 @@
         "node": ">= 0.4"
       }
     },
+    "node_modules/mdast-util-definitions": {
+      "version": "4.0.0",
+      "resolved": "https://registry.npmjs.org/mdast-util-definitions/-/mdast-util-definitions-4.0.0.tgz",
+      "integrity": "sha512-k8AJ6aNnUkB7IE+5azR9h81O5EQ/cTDXtWdMq9Kk5KcEW/8ritU5CeLg/9HhOC++nALHBlaogJ5jz0Ybk3kPMQ==",
+      "license": "MIT",
+      "dependencies": {
+        "unist-util-visit": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-find-and-replace": {
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/mdast-util-find-and-replace/-/mdast-util-find-and-replace-1.1.1.tgz",
+      "integrity": "sha512-9cKl33Y21lyckGzpSmEQnIDjEfeeWelN5s1kUW1LwdB0Fkuq2u+4GdqcGEygYxJE8GVqCl0741bYXHgamfWAZA==",
+      "license": "MIT",
+      "dependencies": {
+        "escape-string-regexp": "^4.0.0",
+        "unist-util-is": "^4.0.0",
+        "unist-util-visit-parents": "^3.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-from-markdown": {
+      "version": "0.8.5",
+      "resolved": "https://registry.npmjs.org/mdast-util-from-markdown/-/mdast-util-from-markdown-0.8.5.tgz",
+      "integrity": "sha512-2hkTXtYYnr+NubD/g6KGBS/0mFmBcifAsI0yIWRiRo0PjVs6SSOSOdtzbp6kSGnShDN6G5aWZpKQ2lWRy27mWQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/mdast": "^3.0.0",
+        "mdast-util-to-string": "^2.0.0",
+        "micromark": "~2.11.0",
+        "parse-entities": "^2.0.0",
+        "unist-util-stringify-position": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm": {
+      "version": "0.1.2",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm/-/mdast-util-gfm-0.1.2.tgz",
+      "integrity": "sha512-NNkhDx/qYcuOWB7xHUGWZYVXvjPFFd6afg6/e2g+SV4r9q5XUcCbV4Wfa3DLYIiD+xAEZc6K4MGaE/m0KDcPwQ==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-gfm-autolink-literal": "^0.1.0",
+        "mdast-util-gfm-strikethrough": "^0.2.0",
+        "mdast-util-gfm-table": "^0.1.0",
+        "mdast-util-gfm-task-list-item": "^0.1.0",
+        "mdast-util-to-markdown": "^0.6.1"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-autolink-literal": {
+      "version": "0.1.3",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-autolink-literal/-/mdast-util-gfm-autolink-literal-0.1.3.tgz",
+      "integrity": "sha512-GjmLjWrXg1wqMIO9+ZsRik/s7PLwTaeCHVB7vRxUwLntZc8mzmTsLVr6HW1yLokcnhfURsn5zmSVdi3/xWWu1A==",
+      "license": "MIT",
+      "dependencies": {
+        "ccount": "^1.0.0",
+        "mdast-util-find-and-replace": "^1.1.0",
+        "micromark": "^2.11.3"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-strikethrough": {
+      "version": "0.2.3",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-strikethrough/-/mdast-util-gfm-strikethrough-0.2.3.tgz",
+      "integrity": "sha512-5OQLXpt6qdbttcDG/UxYY7Yjj3e8P7X16LzvpX8pIQPYJ/C2Z1qFGMmcw+1PZMUM3Z8wt8NRfYTvCni93mgsgA==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-to-markdown": "^0.6.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-table": {
+      "version": "0.1.6",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-table/-/mdast-util-gfm-table-0.1.6.tgz",
+      "integrity": "sha512-j4yDxQ66AJSBwGkbpFEp9uG/LS1tZV3P33fN1gkyRB2LoRL+RR3f76m0HPHaby6F4Z5xr9Fv1URmATlRRUIpRQ==",
+      "license": "MIT",
+      "dependencies": {
+        "markdown-table": "^2.0.0",
+        "mdast-util-to-markdown": "~0.6.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-task-list-item": {
+      "version": "0.1.6",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-task-list-item/-/mdast-util-gfm-task-list-item-0.1.6.tgz",
+      "integrity": "sha512-/d51FFIfPsSmCIRNp7E6pozM9z1GYPIkSy1urQ8s/o4TC22BZ7DqfHFWiqBD23bc7J3vV1Fc9O4QIHBlfuit8A==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-to-markdown": "~0.6.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-to-hast": {
+      "version": "10.2.0",
+      "resolved": "https://registry.npmjs.org/mdast-util-to-hast/-/mdast-util-to-hast-10.2.0.tgz",
+      "integrity": "sha512-JoPBfJ3gBnHZ18icCwHR50orC9kNH81tiR1gs01D8Q5YpV6adHNO9nKNuFBCJQ941/32PT1a63UF/DitmS3amQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/mdast": "^3.0.0",
+        "@types/unist": "^2.0.0",
+        "mdast-util-definitions": "^4.0.0",
+        "mdurl": "^1.0.0",
+        "unist-builder": "^2.0.0",
+        "unist-util-generated": "^1.0.0",
+        "unist-util-position": "^3.0.0",
+        "unist-util-visit": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-to-hast/node_modules/mdurl": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/mdurl/-/mdurl-1.0.1.tgz",
+      "integrity": "sha512-/sKlQJCBYVY9Ers9hqzKou4H6V5UWc/M59TH2dvkt+84itfnq7uFOMLpOiOS4ujvHP4etln18fmIxA5R5fll0g==",
+      "license": "MIT"
+    },
+    "node_modules/mdast-util-to-markdown": {
+      "version": "0.6.5",
+      "resolved": "https://registry.npmjs.org/mdast-util-to-markdown/-/mdast-util-to-markdown-0.6.5.tgz",
+      "integrity": "sha512-XeV9sDE7ZlOQvs45C9UKMtfTcctcaj/pGwH8YLbMHoMOXNNCn2LsqVQOqrF1+/NU8lKDAqozme9SCXWyo9oAcQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2.0.0",
+        "longest-streak": "^2.0.0",
+        "mdast-util-to-string": "^2.0.0",
+        "parse-entities": "^2.0.0",
+        "repeat-string": "^1.0.0",
+        "zwitch": "^1.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-to-string": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/mdast-util-to-string/-/mdast-util-to-string-2.0.0.tgz",
+      "integrity": "sha512-AW4DRS3QbBayY/jJmD8437V1Gombjf8RSOUCMFBuo5iHi58AGEgVCKQ+ezHkZZDpAQS75hcBMpLqjpJTjtUL7w==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
     "node_modules/mdurl": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/mdurl/-/mdurl-2.0.0.tgz",
@@ -10751,52 +11681,152 @@
         "node": ">= 8"
       }
     },
-    "node_modules/micromatch": {
-      "version": "4.0.8",
-      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
-      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
-      "dev": true,
+    "node_modules/micromark": {
+      "version": "2.11.4",
+      "resolved": "https://registry.npmjs.org/micromark/-/micromark-2.11.4.tgz",
+      "integrity": "sha512-+WoovN/ppKolQOFIAajxi7Lu9kInbPxFuTBVEavFcL8eAfVstoc5MocPmqBeAdBOJV00uaVjegzH4+MA0DN/uA==",
+      "funding": [
+        {
+          "type": "GitHub Sponsors",
+          "url": "https://github.com/sponsors/unifiedjs"
+        },
+        {
+          "type": "OpenCollective",
+          "url": "https://opencollective.com/unified"
+        }
+      ],
       "license": "MIT",
       "dependencies": {
-        "braces": "^3.0.3",
-        "picomatch": "^2.3.1"
-      },
-      "engines": {
-        "node": ">=8.6"
+        "debug": "^4.0.0",
+        "parse-entities": "^2.0.0"
       }
     },
-    "node_modules/mime": {
-      "version": "3.0.0",
-      "resolved": "https://registry.npmjs.org/mime/-/mime-3.0.0.tgz",
-      "integrity": "sha512-jSCU7/VB1loIWBZe14aEYHU/+1UMEHoaO7qxCOVJOw9GgH72VAWppxNcjU+x9a2k3GSIBXNKxXQFqRvvZ7vr3A==",
+    "node_modules/micromark-extension-gfm": {
+      "version": "0.3.3",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm/-/micromark-extension-gfm-0.3.3.tgz",
+      "integrity": "sha512-oVN4zv5/tAIA+l3GbMi7lWeYpJ14oQyJ3uEim20ktYFAcfX1x3LNlFGGlmrZHt7u9YlKExmyJdDGaTt6cMSR/A==",
       "license": "MIT",
-      "optional": true,
-      "bin": {
-        "mime": "cli.js"
+      "dependencies": {
+        "micromark": "~2.11.0",
+        "micromark-extension-gfm-autolink-literal": "~0.5.0",
+        "micromark-extension-gfm-strikethrough": "~0.6.5",
+        "micromark-extension-gfm-table": "~0.4.0",
+        "micromark-extension-gfm-tagfilter": "~0.3.0",
+        "micromark-extension-gfm-task-list-item": "~0.3.0"
       },
-      "engines": {
-        "node": ">=10.0.0"
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
       }
     },
-    "node_modules/mime-db": {
-      "version": "1.52.0",
-      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
-      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
+    "node_modules/micromark-extension-gfm-autolink-literal": {
+      "version": "0.5.7",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-autolink-literal/-/micromark-extension-gfm-autolink-literal-0.5.7.tgz",
+      "integrity": "sha512-ePiDGH0/lhcngCe8FtH4ARFoxKTUelMp4L7Gg2pujYD5CSMb9PbblnyL+AAMud/SNMyusbS2XDSiPIRcQoNFAw==",
       "license": "MIT",
-      "engines": {
-        "node": ">= 0.6"
+      "dependencies": {
+        "micromark": "~2.11.3"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
       }
     },
-    "node_modules/mime-types": {
-      "version": "2.1.35",
-      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
-      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
+    "node_modules/micromark-extension-gfm-strikethrough": {
+      "version": "0.6.5",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-strikethrough/-/micromark-extension-gfm-strikethrough-0.6.5.tgz",
+      "integrity": "sha512-PpOKlgokpQRwUesRwWEp+fHjGGkZEejj83k9gU5iXCbDG+XBA92BqnRKYJdfqfkrRcZRgGuPuXb7DaK/DmxOhw==",
       "license": "MIT",
       "dependencies": {
-        "mime-db": "1.52.0"
+        "micromark": "~2.11.0"
       },
-      "engines": {
-        "node": ">= 0.6"
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromark-extension-gfm-table": {
+      "version": "0.4.3",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-table/-/micromark-extension-gfm-table-0.4.3.tgz",
+      "integrity": "sha512-hVGvESPq0fk6ALWtomcwmgLvH8ZSVpcPjzi0AjPclB9FsVRgMtGZkUcpE0zgjOCFAznKepF4z3hX8z6e3HODdA==",
+      "license": "MIT",
+      "dependencies": {
+        "micromark": "~2.11.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromark-extension-gfm-tagfilter": {
+      "version": "0.3.0",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-tagfilter/-/micromark-extension-gfm-tagfilter-0.3.0.tgz",
+      "integrity": "sha512-9GU0xBatryXifL//FJH+tAZ6i240xQuFrSL7mYi8f4oZSbc+NvXjkrHemeYP0+L4ZUT+Ptz3b95zhUZnMtoi/Q==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromark-extension-gfm-task-list-item": {
+      "version": "0.3.3",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-task-list-item/-/micromark-extension-gfm-task-list-item-0.3.3.tgz",
+      "integrity": "sha512-0zvM5iSLKrc/NQl84pZSjGo66aTGd57C1idmlWmE87lkMcXrTxg1uXa/nXomxJytoje9trP0NDLvw4bZ/Z/XCQ==",
+      "license": "MIT",
+      "dependencies": {
+        "micromark": "~2.11.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromatch": {
+      "version": "4.0.8",
+      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
+      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "braces": "^3.0.3",
+        "picomatch": "^2.3.1"
+      },
+      "engines": {
+        "node": ">=8.6"
+      }
+    },
+    "node_modules/mime": {
+      "version": "3.0.0",
+      "resolved": "https://registry.npmjs.org/mime/-/mime-3.0.0.tgz",
+      "integrity": "sha512-jSCU7/VB1loIWBZe14aEYHU/+1UMEHoaO7qxCOVJOw9GgH72VAWppxNcjU+x9a2k3GSIBXNKxXQFqRvvZ7vr3A==",
+      "license": "MIT",
+      "optional": true,
+      "bin": {
+        "mime": "cli.js"
+      },
+      "engines": {
+        "node": ">=10.0.0"
+      }
+    },
+    "node_modules/mime-db": {
+      "version": "1.52.0",
+      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
+      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 0.6"
+      }
+    },
+    "node_modules/mime-types": {
+      "version": "2.1.35",
+      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
+      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
+      "license": "MIT",
+      "dependencies": {
+        "mime-db": "1.52.0"
+      },
+      "engines": {
+        "node": ">= 0.6"
       }
     },
     "node_modules/mimic-fn": {
@@ -11421,6 +12451,24 @@
         "node": ">=6"
       }
     },
+    "node_modules/parse-entities": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/parse-entities/-/parse-entities-2.0.0.tgz",
+      "integrity": "sha512-kkywGpCcRYhqQIchaWqZ875wzpS/bMKhz5HnN3p7wveJTkTtyAB/AlnS0f8DFSqYW1T82t6yEAkEcB+A1I3MbQ==",
+      "license": "MIT",
+      "dependencies": {
+        "character-entities": "^1.0.0",
+        "character-entities-legacy": "^1.0.0",
+        "character-reference-invalid": "^1.0.0",
+        "is-alphanumerical": "^1.0.0",
+        "is-decimal": "^1.0.0",
+        "is-hexadecimal": "^1.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/parse-json": {
       "version": "5.2.0",
       "resolved": "https://registry.npmjs.org/parse-json/-/parse-json-5.2.0.tgz",
@@ -11494,6 +12542,15 @@
       "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
       "license": "MIT"
     },
+    "node_modules/path-to-regexp": {
+      "version": "8.2.0",
+      "resolved": "https://registry.npmjs.org/path-to-regexp/-/path-to-regexp-8.2.0.tgz",
+      "integrity": "sha512-TdrF7fW9Rphjq4RjrW0Kp2AW0Ahwu9sRGTkS6bvDi0SCwZlEZYmcfDbEsTz8RVk0EHIS/Vd1bv3JhG+1xZuAyQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=16"
+      }
+    },
     "node_modules/path-type": {
       "version": "4.0.0",
       "resolved": "https://registry.npmjs.org/path-type/-/path-type-4.0.0.tgz",
@@ -11784,6 +12841,19 @@
       "integrity": "sha512-24e6ynE2H+OKt4kqsOvNd8kBpV65zoxbA4BVsEOB3ARVWQki/DHzaUoC5KuON/BiccDaCCTZBuOcfZs70kR8bQ==",
       "license": "MIT"
     },
+    "node_modules/property-information": {
+      "version": "5.6.0",
+      "resolved": "https://registry.npmjs.org/property-information/-/property-information-5.6.0.tgz",
+      "integrity": "sha512-YUHSPk+A30YPv+0Qf8i9Mbfe/C0hdPXk1s1jPVToV8pk8BQtpw10ct89Eo7OWkutrwqvT0eicAxlOg3dOAu8JA==",
+      "license": "MIT",
+      "dependencies": {
+        "xtend": "^4.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/proto3-json-serializer": {
       "version": "2.0.2",
       "resolved": "https://registry.npmjs.org/proto3-json-serializer/-/proto3-json-serializer-2.0.2.tgz",
@@ -11834,71 +12904,695 @@
       "resolved": "https://registry.npmjs.org/punycode.js/-/punycode.js-2.3.1.tgz",
       "integrity": "sha512-uxFIHU0YlHYhDQtV4R9J6a52SLx28BCjT+4ieh7IGbgwVJWO+km431c4yRlREUAsAmt/uMjQUyQHNEPf0M39CA==",
       "license": "MIT",
-      "engines": {
-        "node": ">=6"
+      "engines": {
+        "node": ">=6"
+      }
+    },
+    "node_modules/pure-rand": {
+      "version": "6.1.0",
+      "resolved": "https://registry.npmjs.org/pure-rand/-/pure-rand-6.1.0.tgz",
+      "integrity": "sha512-bVWawvoZoBYpp6yIoQtQXHZjmz35RSVHnUOTefl8Vcjr8snTPY1wnpSPMWekcFwbxI6gtmT7rSYPFvz71ldiOA==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "individual",
+          "url": "https://github.com/sponsors/dubzzz"
+        },
+        {
+          "type": "opencollective",
+          "url": "https://opencollective.com/fast-check"
+        }
+      ],
+      "license": "MIT"
+    },
+    "node_modules/qs": {
+      "version": "6.14.0",
+      "resolved": "https://registry.npmjs.org/qs/-/qs-6.14.0.tgz",
+      "integrity": "sha512-YWWTjgABSKcvs/nWBi9PycY/JiPJqOD4JA6o9Sej2AtvSGarXxKC3OQSk4pAarbdQlKAh5D4FCQkJNkW+GAn3w==",
+      "license": "BSD-3-Clause",
+      "dependencies": {
+        "side-channel": "^1.1.0"
+      },
+      "engines": {
+        "node": ">=0.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/ljharb"
+      }
+    },
+    "node_modules/querystring-es3": {
+      "version": "0.2.1",
+      "resolved": "https://registry.npmjs.org/querystring-es3/-/querystring-es3-0.2.1.tgz",
+      "integrity": "sha512-773xhDQnZBMFobEiztv8LIl70ch5MSF/jUQVlhwFyBILqq96anmoctVIYz+ZRp0qbCKATTn6ev02M3r7Ga5vqA==",
+      "engines": {
+        "node": ">=0.4.x"
+      }
+    },
+    "node_modules/queue-microtask": {
+      "version": "1.2.3",
+      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
+      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/feross"
+        },
+        {
+          "type": "patreon",
+          "url": "https://www.patreon.com/feross"
+        },
+        {
+          "type": "consulting",
+          "url": "https://feross.org/support"
+        }
+      ],
+      "license": "MIT"
+    },
+    "node_modules/rc-cascader": {
+      "version": "3.34.0",
+      "resolved": "https://registry.npmjs.org/rc-cascader/-/rc-cascader-3.34.0.tgz",
+      "integrity": "sha512-KpXypcvju9ptjW9FaN2NFcA2QH9E9LHKq169Y0eWtH4e/wHQ5Wh5qZakAgvb8EKZ736WZ3B0zLLOBsrsja5Dag==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.25.7",
+        "classnames": "^2.3.1",
+        "rc-select": "~14.16.2",
+        "rc-tree": "~5.13.0",
+        "rc-util": "^5.43.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-checkbox": {
+      "version": "3.5.0",
+      "resolved": "https://registry.npmjs.org/rc-checkbox/-/rc-checkbox-3.5.0.tgz",
+      "integrity": "sha512-aOAQc3E98HteIIsSqm6Xk2FPKIER6+5vyEFMZfo73TqM+VVAIqOkHoPjgKLqSNtVLWScoaM7vY2ZrGEheI79yg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.25.2"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-checkbox/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/rc-collapse": {
+      "version": "3.9.0",
+      "resolved": "https://registry.npmjs.org/rc-collapse/-/rc-collapse-3.9.0.tgz",
+      "integrity": "sha512-swDdz4QZ4dFTo4RAUMLL50qP0EY62N2kvmk2We5xYdRwcRn8WcYtuetCJpwpaCbUfUt5+huLpVxhvmnK+PHrkA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "2.x",
+        "rc-motion": "^2.3.4",
+        "rc-util": "^5.27.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-dialog": {
+      "version": "9.6.0",
+      "resolved": "https://registry.npmjs.org/rc-dialog/-/rc-dialog-9.6.0.tgz",
+      "integrity": "sha512-ApoVi9Z8PaCQg6FsUzS8yvBEQy0ZL2PkuvAgrmohPkN3okps5WZ5WQWPc1RNuiOKaAYv8B97ACdsFU5LizzCqg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/portal": "^1.0.0-8",
+        "classnames": "^2.2.6",
+        "rc-motion": "^2.3.0",
+        "rc-util": "^5.21.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-drawer": {
+      "version": "7.3.0",
+      "resolved": "https://registry.npmjs.org/rc-drawer/-/rc-drawer-7.3.0.tgz",
+      "integrity": "sha512-DX6CIgiBWNpJIMGFO8BAISFkxiuKitoizooj4BDyee8/SnBn0zwO2FHrNDpqqepj0E/TFTDpmEBCyFuTgC7MOg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.23.9",
+        "@rc-component/portal": "^1.1.1",
+        "classnames": "^2.2.6",
+        "rc-motion": "^2.6.1",
+        "rc-util": "^5.38.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-dropdown": {
+      "version": "4.2.1",
+      "resolved": "https://registry.npmjs.org/rc-dropdown/-/rc-dropdown-4.2.1.tgz",
+      "integrity": "sha512-YDAlXsPv3I1n42dv1JpdM7wJ+gSUBfeyPK59ZpBD9jQhK9jVuxpjj3NmWQHOBceA1zEPVX84T2wbdb2SD0UjmA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.3",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.2.6",
+        "rc-util": "^5.44.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.11.0",
+        "react-dom": ">=16.11.0"
+      }
+    },
+    "node_modules/rc-field-form": {
+      "version": "2.7.0",
+      "resolved": "https://registry.npmjs.org/rc-field-form/-/rc-field-form-2.7.0.tgz",
+      "integrity": "sha512-hgKsCay2taxzVnBPZl+1n4ZondsV78G++XVsMIJCAoioMjlMQR9YwAp7JZDIECzIu2Z66R+f4SFIRrO2DjDNAA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "@rc-component/async-validator": "^5.0.3",
+        "rc-util": "^5.32.2"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-image": {
+      "version": "7.12.0",
+      "resolved": "https://registry.npmjs.org/rc-image/-/rc-image-7.12.0.tgz",
+      "integrity": "sha512-cZ3HTyyckPnNnUb9/DRqduqzLfrQRyi+CdHjdqgsyDpI3Ln5UX1kXnAhPBSJj9pVRzwRFgqkN7p9b6HBDjmu/Q==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.2",
+        "@rc-component/portal": "^1.0.2",
+        "classnames": "^2.2.6",
+        "rc-dialog": "~9.6.0",
+        "rc-motion": "^2.6.2",
+        "rc-util": "^5.34.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-input": {
+      "version": "1.8.0",
+      "resolved": "https://registry.npmjs.org/rc-input/-/rc-input-1.8.0.tgz",
+      "integrity": "sha512-KXvaTbX+7ha8a/k+eg6SYRVERK0NddX8QX7a7AnRvUa/rEH0CNMlpcBzBkhI0wp2C8C4HlMoYl8TImSN+fuHKA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "classnames": "^2.2.1",
+        "rc-util": "^5.18.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.0.0",
+        "react-dom": ">=16.0.0"
+      }
+    },
+    "node_modules/rc-input-number": {
+      "version": "9.5.0",
+      "resolved": "https://registry.npmjs.org/rc-input-number/-/rc-input-number-9.5.0.tgz",
+      "integrity": "sha512-bKaEvB5tHebUURAEXw35LDcnRZLq3x1k7GxfAqBMzmpHkDGzjAtnUL8y4y5N15rIFIg5IJgwr211jInl3cipag==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/mini-decimal": "^1.0.1",
+        "classnames": "^2.2.5",
+        "rc-input": "~1.8.0",
+        "rc-util": "^5.40.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-mentions": {
+      "version": "2.20.0",
+      "resolved": "https://registry.npmjs.org/rc-mentions/-/rc-mentions-2.20.0.tgz",
+      "integrity": "sha512-w8HCMZEh3f0nR8ZEd466ATqmXFCMGMN5UFCzEUL0bM/nGw/wOS2GgRzKBcm19K++jDyuWCOJOdgcKGXU3fXfbQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.22.5",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.2.6",
+        "rc-input": "~1.8.0",
+        "rc-menu": "~9.16.0",
+        "rc-textarea": "~1.10.0",
+        "rc-util": "^5.34.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-menu": {
+      "version": "9.16.1",
+      "resolved": "https://registry.npmjs.org/rc-menu/-/rc-menu-9.16.1.tgz",
+      "integrity": "sha512-ghHx6/6Dvp+fw8CJhDUHFHDJ84hJE3BXNCzSgLdmNiFErWSOaZNsihDAsKq9ByTALo/xkNIwtDFGIl6r+RPXBg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "2.x",
+        "rc-motion": "^2.4.3",
+        "rc-overflow": "^1.3.1",
+        "rc-util": "^5.27.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-motion": {
+      "version": "2.9.5",
+      "resolved": "https://registry.npmjs.org/rc-motion/-/rc-motion-2.9.5.tgz",
+      "integrity": "sha512-w+XTUrfh7ArbYEd2582uDrEhmBHwK1ZENJiSJVb7uRxdE7qJSYjbO2eksRXmndqyKqKoYPc9ClpPh5242mV1vA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "classnames": "^2.2.1",
+        "rc-util": "^5.44.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-notification": {
+      "version": "5.6.4",
+      "resolved": "https://registry.npmjs.org/rc-notification/-/rc-notification-5.6.4.tgz",
+      "integrity": "sha512-KcS4O6B4qzM3KH7lkwOB7ooLPZ4b6J+VMmQgT51VZCeEcmghdeR4IrMcFq0LG+RPdnbe/ArT086tGM8Snimgiw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "2.x",
+        "rc-motion": "^2.9.0",
+        "rc-util": "^5.20.1"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-overflow": {
+      "version": "1.4.1",
+      "resolved": "https://registry.npmjs.org/rc-overflow/-/rc-overflow-1.4.1.tgz",
+      "integrity": "sha512-3MoPQQPV1uKyOMVNd6SZfONi+f3st0r8PksexIdBTeIYbMX0Jr+k7pHEDvsXtR4BpCv90/Pv2MovVNhktKrwvw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "classnames": "^2.2.1",
+        "rc-resize-observer": "^1.0.0",
+        "rc-util": "^5.37.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-pagination": {
+      "version": "5.1.0",
+      "resolved": "https://registry.npmjs.org/rc-pagination/-/rc-pagination-5.1.0.tgz",
+      "integrity": "sha512-8416Yip/+eclTFdHXLKTxZvn70duYVGTvUUWbckCCZoIl3jagqke3GLsFrMs0bsQBikiYpZLD9206Ej4SOdOXQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.38.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-pagination/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/rc-picker": {
+      "version": "4.11.3",
+      "resolved": "https://registry.npmjs.org/rc-picker/-/rc-picker-4.11.3.tgz",
+      "integrity": "sha512-MJ5teb7FlNE0NFHTncxXQ62Y5lytq6sh5nUw0iH8OkHL/TjARSEvSHpr940pWgjGANpjCwyMdvsEV55l5tYNSg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.7",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.2.1",
+        "rc-overflow": "^1.3.2",
+        "rc-resize-observer": "^1.4.0",
+        "rc-util": "^5.43.0"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "date-fns": ">= 2.x",
+        "dayjs": ">= 1.x",
+        "luxon": ">= 3.x",
+        "moment": ">= 2.x",
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      },
+      "peerDependenciesMeta": {
+        "date-fns": {
+          "optional": true
+        },
+        "dayjs": {
+          "optional": true
+        },
+        "luxon": {
+          "optional": true
+        },
+        "moment": {
+          "optional": true
+        }
```
