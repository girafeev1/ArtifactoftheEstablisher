# PR #290 — Diff Summary

- **Base (target)**: `a0c346ddf8077cf032d73a354ad446b45eb39429`
- **Head (source)**: `adfd601822e2829205c03738f910e1116e1e60df`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	components/client-accounts/NewUIClientAccountsApp.tsx
A	components/new-ui/AppShell.tsx
A	components/projects/NewUIProjectsApp.tsx
M	next.config.ts
A	pages/api/projects/index.ts
M	pages/dashboard/new-ui/index.tsx
A	pages/dashboard/new-ui/projects.tsx
```

## Stats

```txt
 .../client-accounts/NewUIClientAccountsApp.tsx     | 278 +--------
 components/new-ui/AppShell.tsx                     | 304 ++++++++++
 components/projects/NewUIProjectsApp.tsx           | 663 +++++++++++++++++++++
 next.config.ts                                     |   9 +-
 pages/api/projects/index.ts                        |  82 +++
 pages/dashboard/new-ui/index.tsx                   |   3 +
 pages/dashboard/new-ui/projects.tsx                |  65 ++
 7 files changed, 1143 insertions(+), 261 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/components/client-accounts/NewUIClientAccountsApp.tsx b/components/client-accounts/NewUIClientAccountsApp.tsx
index 6f9cd25..66cfdda 100644
--- a/components/client-accounts/NewUIClientAccountsApp.tsx
+++ b/components/client-accounts/NewUIClientAccountsApp.tsx
@@ -1,7 +1,5 @@
 import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react"
 import {
-  Refine,
-  useMenu,
   type BaseRecord,
   type CrudFilters,
   type CrudSorting,
@@ -10,19 +8,14 @@ import {
   type HttpError,
 } from "@refinedev/core"
 import { List, FilterDropdown, useTable } from "@refinedev/antd"
-import routerProvider from "@refinedev/nextjs-router"
 import {
   App as AntdApp,
   Avatar,
-  Badge,
   Button,
-  ConfigProvider,
   Drawer,
   Form,
   Grid,
   Input,
-  Layout,
-  Menu,
   Modal,
   Select,
   Space,
@@ -33,36 +26,24 @@ import {
   Typography,
 } from "antd"
 import {
-  ApartmentOutlined,
-  AppstoreOutlined,
-  BarsOutlined,
-  BellOutlined,
-  CalendarOutlined,
   CheckCircleOutlined,
   CloseCircleOutlined,
   EyeOutlined,
   MailOutlined,
-  MenuFoldOutlined,
-  MenuUnfoldOutlined,
   PhoneOutlined,
   PlusCircleOutlined,
   SearchOutlined,
-  SettingOutlined,
-  TeamOutlined,
-  ThunderboltFilled,
-  UnorderedListOutlined,
 } from "@ant-design/icons"
 import debounce from "lodash.debounce"
 import type { ClientDirectoryRecord } from "../../lib/clientDirectory"
 
+import AppShell from "../new-ui/AppShell"
+
 type DirectoryApiRecord = ClientDirectoryRecord & { id: string }
 
-const { Header, Content, Sider } = Layout
 const { Text } = Typography
 
-const HEADER_HEIGHT = 64
-const HEADER_HORIZONTAL_PADDING = 24
-const ALLOWED_MENU_KEYS = new Set(["dashboard", "client-directory"])
+const ALLOWED_MENU_KEYS = ["dashboard", "client-directory"] as const
 
 if (typeof window === "undefined") {
   console.info("[client-accounts] Module loaded", {
@@ -1123,196 +1104,6 @@ const AddClientModal = ({
   )
 }
 
-const NavigationSider = ({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: (value: boolean) => void }) => {
-  const { menuItems, selectedKey } = useMenu()
-  const breakpoint = Grid.useBreakpoint()
-  const isMobile = typeof breakpoint.lg === "undefined" ? false : !breakpoint.lg
-
-  const navigationItems = menuItems
-    .filter((item) => ALLOWED_MENU_KEYS.has((item.name as string | undefined) ?? ""))
-    .map((item) => {
-      const key = item.key ?? item.name
-      const route = item.route ?? item.list
-      if (!route) {
-        return null
-      }
-      return {
-        key,
-        icon: iconForMenu(item.name ?? ""),
-        label: item.label,
-        route,
-      }
-    })
-    .filter(Boolean) as Array<{ key: string; icon: ReactNode; label: ReactNode; route: string }>
-
-  const handleMenuClick = (event: { key: string }) => {
-    const target = navigationItems.find((item) => item.key === event.key)
-    if (target?.route && typeof window !== "undefined") {
-      window.location.href = target.route
-    }
-  }
-
-  const menuEntries = navigationItems.map((item) => ({
-    key: item.key,
-    icon: item.icon,
-    label: item.label,
-  }))
-
-  const content = (
-    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
-      <div
-        style={{
-          height: HEADER_HEIGHT,
-          display: "flex",
-          alignItems: "center",
-          gap: 12,
-          padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
-          borderBottom: "1px solid #e5e7eb",
-          overflow: "hidden",
-        }}
-      >
-        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
-          <Avatar shape="square" size={36} style={{ backgroundColor: "#2563eb" }}>
-            <ThunderboltFilled />
-          </Avatar>
-          {!collapsed ? (
-            <Text
-              strong
-              style={{
-                fontSize: 18,
-                whiteSpace: "nowrap",
-                textOverflow: "ellipsis",
-                overflow: "hidden",
-              }}
-            >
-              The Establishers
-            </Text>
-          ) : null}
-        </div>
-      </div>
-      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
-        <Menu
-          mode="inline"
-          selectedKeys={selectedKey ? [selectedKey] : []}
-          style={{
-            flex: 1,
-            borderInlineEnd: "none",
-            paddingTop: 16,
-          }}
-          items={menuEntries}
-          onClick={handleMenuClick}
-        />
-        <div style={{ padding: collapsed ? 16 : 24, marginTop: "auto" }}>
-          <Button
-            type="text"
-            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
-            onClick={() => onCollapse(!collapsed)}
-            style={{
-              width: "100%",
-              justifyContent: collapsed ? "center" : "flex-start",
-              borderRadius: 10,
-              background: "#f1f5f9",
-              padding: collapsed ? "12px" : "12px 16px",
-              color: "#1e3a8a",
-              fontWeight: 600,
-            }}
-          >
-            {collapsed ? null : "Collapse sidebar"}
-          </Button>
-        </div>
-      </div>
-    </div>
-  )
-
-  if (isMobile) {
-    return (
-      <>
-        <Button
-          type="primary"
-          icon={<BarsOutlined />}
-          style={{
-            position: "fixed",
-            top: HEADER_HEIGHT,
-            left: 0,
-            zIndex: 1300,
-            borderTopLeftRadius: 0,
-            borderBottomLeftRadius: 0,
-          }}
-          onClick={() => onCollapse(!collapsed)}
-        />
-        <Drawer placement="left" open={!collapsed} onClose={() => onCollapse(true)} width={256} bodyStyle={{ padding: 0 }}>
-          {content}
-        </Drawer>
-      </>
-    )
-  }
-
-  return (
-    <Sider
-      width={256}
-      collapsible
-      collapsed={collapsed}
-      onCollapse={onCollapse}
-      trigger={null}
-      style={{
-        background: "#fff",
-        position: "sticky",
-        top: 0,
-        height: "100vh",
-      }}
-    >
-      {content}
-    </Sider>
-  )
-}
-
-const iconForMenu = (name: string) => {
-  switch (name) {
-    case "dashboard":
-      return <AppstoreOutlined />
-    case "calendar":
-      return <CalendarOutlined />
-    case "scrumboard":
-      return <AppstoreOutlined />
-    case "companies":
-      return <ApartmentOutlined />
-    case "client-directory":
-      return <TeamOutlined />
-    case "quotes":
-      return <SettingOutlined />
-    case "administration":
-      return <SettingOutlined />
-    default:
-      return <UnorderedListOutlined />
-  }
-}
-
-const TopHeader = () => (
-  <Header
-    style={{
-      background: "#fff",
-      display: "flex",
-      alignItems: "center",
-      justifyContent: "flex-end",
-      padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
-      position: "sticky",
-      top: 0,
-      zIndex: 1000,
-      height: HEADER_HEIGHT,
-      borderBottom: "1px solid #e5e7eb",
-    }}
-  >
-    <Space size="large" align="center">
-      <Tooltip title="Notifications">
-        <Badge dot>
-          <Button type="text" shape="circle" icon={<BellOutlined />} />
-        </Badge>
-      </Tooltip>
-      <Avatar style={{ backgroundColor: "#1e3a8a", color: "#fff" }}>TE</Avatar>
-    </Space>
-  </Header>
-)
-
 const ClientAccountsContent = () => {
   const [searchForm] = Form.useForm()
   const screens = Grid.useBreakpoint()
@@ -1618,53 +1409,22 @@ const ClientAccountsContent = () => {
   )
 }
 
-const ClientAccountsShell = () => {
-  const [collapsed, setCollapsed] = useState(true)
 
-  return (
-    <ConfigProvider
-      theme={{
-        token: {
-          colorPrimary: "#2563eb",
-          borderRadius: 10,
-          fontFamily:
-            "'Inter', 'Inter var', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
-        },
-        components: {
-          Button: {
-            fontWeight: 600,
-            borderRadius: 999,
-          },
-        },
-      }}
-    >
-      <AntdApp>
-        <Refine
-          dataProvider={refineDataProvider}
-          routerProvider={routerProvider}
-          resources={[
-            { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
-            {
-              name: "client-directory",
-              list: "/dashboard/new-ui/client-accounts",
-              meta: { label: "Client Accounts" },
-            },
-          ]}
-          options={{ syncWithLocation: false }}
-        >
-          <Layout style={{ minHeight: "100vh", background: "#fff" }}>
-            <NavigationSider collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} />
-            <Layout style={{ background: "#fff" }}>
-              <TopHeader />
-              <Content>
-                <ClientAccountsContent />
-              </Content>
-            </Layout>
-          </Layout>
-        </Refine>
-      </AntdApp>
-    </ConfigProvider>
-  )
-}
+const ClientAccountsShell = () => (
+  <AppShell
+    dataProvider={refineDataProvider}
+    resources={[
+      { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
+      {
+        name: "client-directory",
+        list: "/dashboard/new-ui/client-accounts",
+        meta: { label: "Client Accounts" },
+      },
+    ]}
+    allowedMenuKeys={ALLOWED_MENU_KEYS}
+  >
+    <ClientAccountsContent />
+  </AppShell>
+)
 
 export default ClientAccountsShell
diff --git a/components/new-ui/AppShell.tsx b/components/new-ui/AppShell.tsx
new file mode 100644
index 0000000..0aaafcc
--- /dev/null
+++ b/components/new-ui/AppShell.tsx
@@ -0,0 +1,304 @@
+import { useMemo, useState, type ReactNode } from "react"
+import {
+  Refine,
+  useMenu,
+  type DataProvider,
+  type IResourceItem,
+} from "@refinedev/core"
+import routerProvider from "@refinedev/nextjs-router"
+import {
+  App as AntdApp,
+  Avatar,
+  Badge,
+  Button,
+  ConfigProvider,
+  Drawer,
+  Grid,
+  Layout,
+  Menu,
+  Space,
+  Tooltip,
+  Typography,
+} from "antd"
+import {
+  ApartmentOutlined,
+  AppstoreOutlined,
+  CalendarOutlined,
+  MenuFoldOutlined,
+  MenuUnfoldOutlined,
+  ProjectOutlined,
+  SettingOutlined,
+  TeamOutlined,
+  ThunderboltFilled,
+  UnorderedListOutlined,
+  BellOutlined,
+} from "@ant-design/icons"
+
+type NavigationItem = {
+  key: string
+  icon: ReactNode
+  label: ReactNode
+  route: string
+}
+
+type AppShellProps = {
+  children: ReactNode
+  dataProvider: DataProvider
+  resources: IResourceItem[]
+  allowedMenuKeys?: ReadonlyArray<string>
+}
+
+const { Header, Content, Sider } = Layout
+const { Text } = Typography
+
+const HEADER_HEIGHT = 64
+const HEADER_HORIZONTAL_PADDING = 24
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
+    case "projects":
+      return <ProjectOutlined />
+    case "quotes":
+      return <SettingOutlined />
+    case "administration":
+      return <SettingOutlined />
+    default:
+      return <UnorderedListOutlined />
+  }
+}
+
+type NavigationSiderProps = {
+  collapsed: boolean
+  onCollapse: (value: boolean) => void
+  allowedMenuKeys: ReadonlySet<string>
+}
+
+const NavigationSider = ({
+  collapsed,
+  onCollapse,
+  allowedMenuKeys,
+}: NavigationSiderProps) => {
+  const { menuItems, selectedKey } = useMenu()
+  const breakpoint = Grid.useBreakpoint()
+  const isMobile = typeof breakpoint.lg === "undefined" ? false : !breakpoint.lg
+
+  const navigationItems = useMemo(() => {
+    return menuItems
+      .filter((item) => allowedMenuKeys.has((item.name as string | undefined) ?? ""))
+      .map((item) => {
+        const key = item.key ?? item.name
+        const route = item.route ?? item.list
+        if (!route) {
+          return null
+        }
+        return {
+          key: String(key ?? ""),
+          icon: iconForMenu(String(item.name ?? "")),
+          label: item.label,
+          route,
+        }
+      })
+      .filter(Boolean) as NavigationItem[]
+  }, [allowedMenuKeys, menuItems])
+
+  const menuEntries = useMemo(
+    () =>
+      navigationItems.map((item) => ({
+        key: item.key,
+        icon: item.icon,
+        label: item.label,
+      })),
+    [navigationItems],
+  )
+
+  const handleMenuClick = (event: { key: string }) => {
+    const target = navigationItems.find((item) => item.key === event.key)
+    if (target?.route && typeof window !== "undefined") {
+      window.location.href = target.route
+    }
+  }
+
+  const content = (
+    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
+      <div
+        style={{
+          height: HEADER_HEIGHT,
+          display: "flex",
+          alignItems: "center",
+          gap: 12,
+          padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
+          borderBottom: "1px solid #e5e7eb",
+          overflow: "hidden",
+        }}
+      >
+        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
+          <Avatar shape="square" size={36} style={{ backgroundColor: "#2563eb" }}>
+            <ThunderboltFilled />
+          </Avatar>
+          {!collapsed ? (
+            <Text
+              strong
+              style={{
+                fontSize: 18,
+                whiteSpace: "nowrap",
+                textOverflow: "ellipsis",
+                overflow: "hidden",
+              }}
+            >
+              The Establishers
+            </Text>
+          ) : null}
+        </div>
+      </div>
+      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
+        <Menu
+          mode="inline"
+          selectedKeys={selectedKey ? [selectedKey] : []}
+          onClick={handleMenuClick}
+          style={{
+            flex: 1,
+            borderInlineEnd: "none",
+            paddingTop: 16,
+          }}
+          items={menuEntries}
+        />
+      </div>
+    </div>
+  )
+
+  if (isMobile) {
+    return (
+      <>
+        <Button
+          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
+          type="text"
+          style={{
+            position: "fixed",
+            top: 16,
+            left: 16,
+            zIndex: 1300,
+            borderTopLeftRadius: 0,
+            borderBottomLeftRadius: 0,
+          }}
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
+const TopHeader = () => (
+  <Header
+    style={{
+      background: "#fff",
+      display: "flex",
+      alignItems: "center",
+      justifyContent: "flex-end",
+      padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
+      position: "sticky",
+      top: 0,
+      zIndex: 1000,
+      height: HEADER_HEIGHT,
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
+const themeConfig = {
+  token: {
+    colorPrimary: "#2563eb",
+    borderRadius: 10,
+    fontFamily:
+      "'Inter', 'Inter var', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
+  },
+  components: {
+    Button: {
+      fontWeight: 600,
+      borderRadius: 999,
+    },
+  },
+} as const
+
+const AppShell = ({
+  children,
+  dataProvider,
+  resources,
+  allowedMenuKeys,
+}: AppShellProps) => {
+  const [collapsed, setCollapsed] = useState(true)
+
+  const allowedKeys = useMemo(() => {
+    if (allowedMenuKeys && allowedMenuKeys.length > 0) {
+      return new Set(allowedMenuKeys)
+    }
+    return new Set(
+      resources
+        .map((resource) => resource.name)
+        .filter((name): name is string => typeof name === "string")
+        .map((name) => name),
+    )
+  }, [allowedMenuKeys, resources])
+
+  return (
+    <ConfigProvider theme={themeConfig}>
+      <AntdApp>
+        <Refine
+          dataProvider={dataProvider}
+          routerProvider={routerProvider}
+          resources={resources}
+          options={{ syncWithLocation: false }}
+        >
+          <Layout style={{ minHeight: "100vh", background: "#fff" }}>
+            <NavigationSider collapsed={collapsed} onCollapse={setCollapsed} allowedMenuKeys={allowedKeys} />
+            <Layout style={{ background: "#fff" }}>
+              <TopHeader />
+              <Content>{children}</Content>
+            </Layout>
+          </Layout>
+        </Refine>
+      </AntdApp>
+    </ConfigProvider>
+  )
+}
+
+export default AppShell
diff --git a/components/projects/NewUIProjectsApp.tsx b/components/projects/NewUIProjectsApp.tsx
new file mode 100644
index 0000000..80badb7
--- /dev/null
+++ b/components/projects/NewUIProjectsApp.tsx
@@ -0,0 +1,663 @@
+import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react"
+import {
+  type CrudFilters,
+  type CrudSorting,
+  type DataProvider,
+  type GetListResponse,
+  type HttpError,
+} from "@refinedev/core"
+import { useTable } from "@refinedev/antd"
+import {
+  App as AntdApp,
+  Button,
+  Drawer,
+  Form,
+  Grid,
+  Input,
+  Select,
+  Space,
+  Table,
+  Tag,
+  Typography,
+} from "antd"
+import { ArrowLeftOutlined, EyeOutlined, SearchOutlined } from "@ant-design/icons"
+import debounce from "lodash.debounce"
+
+import type { ProjectRecord } from "../../lib/projectsDatabase"
+import AppShell from "../new-ui/AppShell"
+
+if (typeof window === "undefined") {
+  console.info("[projects] Module loaded", {
+    timestamp: new Date().toISOString(),
+  })
+}
+
+const { Text, Title } = Typography
+
+const ALLOWED_MENU_KEYS = ["dashboard", "projects"] as const
+
+const projectsCache: {
+  years: string[]
+  subsidiaries: string[]
+} = {
+  years: [],
+  subsidiaries: [],
+}
+
+type ProjectsFilter = CrudFilters[number]
+
+type ProjectRow = ProjectRecord & {
+  projectNumber: string
+  projectTitle: string | null
+  clientCompany: string | null
+  subsidiary: string | null
+  searchIndex: string
+}
+
+type ProjectFiltersForm = {
+  year?: string
+  subsidiary?: string
+  search?: string
+}
+
+type ProjectsListResponse = {
+  data?: ProjectRecord[]
+  years?: string[]
+}
+
+const stringOrNA = (value: string | null | undefined) => {
+  if (typeof value !== "string") {
+    return "N/A"
+  }
+  const trimmed = value.trim()
+  return trimmed.length > 0 ? trimmed : "N/A"
+}
+
+const amountText = (value: number | null | undefined) => {
+  if (typeof value !== "number" || Number.isNaN(value)) {
+    return "-"
+  }
+  return `HK$${value.toLocaleString("en-US", {
+    minimumFractionDigits: 0,
+    maximumFractionDigits: 2,
+  })}`
+}
+
+const paidStatusText = (value: boolean | null | undefined) => {
+  if (value === null || value === undefined) {
+    return "N/A"
+  }
+  return value ? "Paid" : "Unpaid"
+}
+
+const paidStatusColor = (value: boolean | null | undefined) => {
+  if (value === null || value === undefined) {
+    return "default"
+  }
+  return value ? "green" : "red"
+}
+
+const paidDateText = (
+  paid: boolean | null | undefined,
+  date: string | null | undefined,
+) => {
+  if (!paid) {
+    return "-"
+  }
+  if (!date) {
+    return "-"
+  }
+  const trimmed = date.trim()
+  return trimmed.length > 0 ? trimmed : "-"
+}
+
+const normalizeProject = (record: ProjectRecord): ProjectRow => {
+  const projectNumber = record.projectNumber?.trim() ?? record.id
+  const projectTitle = record.projectTitle ? record.projectTitle.trim() || null : null
+  const clientCompany = record.clientCompany ? record.clientCompany.trim() || null : null
+  const subsidiary = record.subsidiary ? record.subsidiary.trim() || null : null
+  const searchIndex = [
+    projectNumber,
+    projectTitle ?? "",
+    clientCompany ?? "",
+    subsidiary ?? "",
+    record.invoice ?? "",
+    record.projectNature ?? "",
+    record.presenterWorkType ?? "",
+  ]
+    .join(" ")
+    .toLowerCase()
+
+  return {
+    ...record,
+    projectNumber,
+    projectTitle,
+    clientCompany,
+    subsidiary,
+    searchIndex,
+  }
+}
+
+const isFieldFilter = (filter: ProjectsFilter): filter is ProjectsFilter & { field: string } =>
+  typeof filter === "object" && filter !== null && "field" in filter
+
+const collectFilterValue = (filters: CrudFilters | undefined, field: string) => {
+  if (!filters) {
+    return undefined
+  }
+  const entry = (filters as Array<{ field?: string; value?: unknown }>).find(
+    (item) => item && typeof item === "object" && "field" in item && item.field === field,
+  )
+  return entry?.value as string | undefined
+}
+
+const applySorting = (rows: ProjectRow[], sorters?: CrudSorting) => {
+  if (!sorters || sorters.length === 0) {
+    return rows
+  }
+
+  const mapValue = (row: ProjectRow, field: string): string | number | null => {
+    switch (field) {
+      case "projectDateIso": {
+        const source = row.projectDateIso
+        if (!source) return null
+        const parsed = new Date(source)
+        return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
+      }
+      case "projectNumber":
+        return row.projectNumber
+      case "clientCompany":
+        return row.clientCompany ?? null
+      case "projectTitle":
+        return row.projectTitle ?? null
+      case "amount":
+        return row.amount ?? null
+      case "paid":
+        return row.paid ?? null
+      case "subsidiary":
+        return row.subsidiary ?? null
+      case "year":
+        return row.year
+      default:
+        return null
+    }
+  }
+
+  const compare = (aVal: ReturnType<typeof mapValue>, bVal: ReturnType<typeof mapValue>) => {
+    if (aVal === bVal) return 0
+    if (aVal === null || aVal === undefined) return -1
+    if (bVal === null || bVal === undefined) return 1
+    if (typeof aVal === "number" && typeof bVal === "number") {
+      if (aVal < bVal) return -1
+      if (aVal > bVal) return 1
+      return 0
+    }
+    return `${aVal}`.localeCompare(`${bVal}`, undefined, { numeric: true, sensitivity: "base" })
+  }
+
+  const activeSorters = sorters.filter((entry) => entry && entry.field && entry.order)
+
+  if (activeSorters.length === 0) {
+    return rows
+  }
+
+  return [...rows].sort((a, b) => {
+    for (const sorter of activeSorters) {
+      const field = sorter.field as string
+      const order = sorter.order === "asc" ? 1 : -1
+      const result = compare(mapValue(a, field), mapValue(b, field))
+      if (result !== 0) {
+        return result * order
+      }
+    }
+    return 0
+  })
+}
+
+const refineDataProvider: DataProvider = {
+  getList: async ({
+    resource,
+    filters,
+    pagination,
+    sorters,
+  }): Promise<GetListResponse<ProjectRow>> => {
+    if (resource !== "projects") {
+      return { data: [], total: 0 }
+    }
+
+    let year: string | undefined
+    let subsidiaryFilter: string | undefined
+    let searchToken: string | undefined
+
+    if (filters) {
+      for (const filter of filters) {
+        if (!isFieldFilter(filter)) continue
+        if (filter.field === "year" && typeof filter.value === "string") {
+          year = filter.value
+        }
+        if (filter.field === "subsidiary" && typeof filter.value === "string") {
+          subsidiaryFilter = filter.value
+        }
+        if (filter.field === "search" && typeof filter.value === "string") {
+          searchToken = filter.value
+        }
+      }
+    }
+
+    const params = new URLSearchParams()
+    if (year) {
+      params.set("year", year)
+    }
+
+    const url = params.toString().length > 0 ? `/api/projects?${params.toString()}` : "/api/projects"
+
+    const response = await fetch(url, { credentials: "include" })
+    if (!response.ok) {
+      throw new Error("Failed to load projects")
+    }
+
+    const payload = (await response.json()) as ProjectsListResponse
+    const rawItems: ProjectRecord[] = payload.data ?? []
+    projectsCache.years = Array.isArray(payload.years) ? payload.years : []
+
+    let normalized = rawItems.map((entry) => normalizeProject(entry))
+
+    const availableSubsidiaries = new Set<string>()
+    normalized.forEach((entry) => {
+      if (entry.subsidiary) {
+        availableSubsidiaries.add(entry.subsidiary)
+      }
+    })
+    projectsCache.subsidiaries = Array.from(availableSubsidiaries).sort((a, b) =>
+      a.localeCompare(b, undefined, { sensitivity: "base" }),
+    )
+
+    if (subsidiaryFilter) {
+      const normalizedFilter = subsidiaryFilter.toLowerCase()
+      normalized = normalized.filter(
+        (entry) => (entry.subsidiary ?? "").toLowerCase() === normalizedFilter,
+      )
+    }
+
+    if (searchToken) {
+      const token = searchToken.trim().toLowerCase()
+      if (token.length > 0) {
+        normalized = normalized.filter((entry) => entry.searchIndex.includes(token))
+      }
+    }
+
+    const sorted = applySorting(normalized, sorters)
+
+    const current = pagination?.current ?? 1
+    const pageSize = pagination?.pageSize ?? 12
+    const start = (current - 1) * pageSize
+    const paginated = sorted.slice(start, start + pageSize)
+
+    return {
+      data: paginated as ProjectRow[],
+      total: sorted.length,
+      meta: {
+        years: projectsCache.years,
+        subsidiaries: projectsCache.subsidiaries,
+      },
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
+const tableHeadingStyle = { fontFamily: "'Cantata One'", fontWeight: 400 }
+const tableCellStyle = { fontFamily: "'Newsreader'", fontWeight: 500 }
+
+const ProjectDetailsDrawer = ({
+  project,
+  open,
+  onClose,
+}: {
+  project: ProjectRow | null
+  open: boolean
+  onClose: () => void
+}) => {
+  const handleClose = () => {
+    onClose()
+  }
+
+  return (
+    <Drawer
+      open={open}
+      onClose={handleClose}
+      width={480}
+      title={<span style={{ fontFamily: "'Cantata One'", fontWeight: 400 }}>Project Details</span>}
+      destroyOnClose
+      bodyStyle={{ padding: 24, background: "#fff" }}
+      headerStyle={{ borderBottom: "1px solid #e5e7eb" }}
+      footer={null}
+    >
+      <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleClose} style={{ marginBottom: 16 }}>
+        Close
+      </Button>
+      {project ? (
+        <Space direction="vertical" size={16} style={{ width: "100%" }}>
+          <DetailField label="Project Number" value={stringOrNA(project.projectNumber)} />
+          <DetailField label="Project Title" value={stringOrNA(project.projectTitle)} />
+          <DetailField label="Client Company" value={stringOrNA(project.clientCompany)} />
+          <DetailField label="Subsidiary" value={stringOrNA(project.subsidiary)} />
+          <DetailField label="Year" value={stringOrNA(project.year)} />
+          <DetailField label="Project Date" value={project.projectDateDisplay ?? "-"} />
+          <DetailField label="On Date" value={paidDateText(project.paid, project.onDateDisplay)} />
+          <DetailField label="Invoice" value={stringOrNA(project.invoice)} />
+          <DetailField label="Paid Status" value={paidStatusText(project.paid)} />
+          <DetailField label="Paid To" value={stringOrNA(project.paidTo)} />
+          <DetailField label="Amount" value={amountText(project.amount)} />
+          <DetailField label="Project Nature" value={stringOrNA(project.projectNature)} />
+          <DetailField label="Presenter Work Type" value={stringOrNA(project.presenterWorkType)} />
+        </Space>
+      ) : (
+        <Text style={tableCellStyle}>Select a project to view details.</Text>
+      )}
+    </Drawer>
+  )
+}
+
+const DetailField = ({ label, value }: { label: string; value: string }) => (
+  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
+    <span style={{ fontFamily: "'Newsreader'", fontWeight: 200 }}>{label}:</span>
+    <span style={tableCellStyle}>{value}</span>
+  </div>
+)
+
+const ProjectsContent = () => {
+  const [filtersForm] = Form.useForm<ProjectFiltersForm>()
+  const screens = Grid.useBreakpoint()
+  const { message } = AntdApp.useApp()
+  const [activeProject, setActiveProject] = useState<ProjectRow | null>(null)
+  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
+
+  const {
+    tableProps,
+    tableQuery,
+    filters,
+    setFilters,
+    setCurrentPage,
+  } = useTable<ProjectRow, HttpError, ProjectFiltersForm>({
+    resource: "projects",
+    pagination: {
+      pageSize: 12,
+    },
+    sorters: {
+      initial: [
+        {
+          field: "projectDateIso",
+          order: "desc",
+        },
+      ],
+    },
+    filters: {
+      initial: [
+        { field: "year", operator: "eq", value: undefined },
+        { field: "subsidiary", operator: "eq", value: undefined },
+        { field: "search", operator: "contains", value: undefined },
+      ],
+    },
+    onSearch: (values) => [
+      {
+        field: "search",
+        operator: "contains",
+        value: values.search,
+      },
+    ],
+    syncWithLocation: false,
+  }) as any
+
+  const availableYears = useMemo(() => {
+    const metaYears = (tableQuery?.data?.meta?.years as string[] | undefined) ?? projectsCache.years
+    return Array.isArray(metaYears) ? metaYears : []
+  }, [tableQuery?.data?.meta?.years])
+
+  const availableSubsidiaries = useMemo(() => {
+    const metaSubs = (tableQuery?.data?.meta?.subsidiaries as string[] | undefined) ?? projectsCache.subsidiaries
+    return Array.isArray(metaSubs) ? metaSubs : []
+  }, [tableQuery?.data?.meta?.subsidiaries])
+
+  const activeYear = collectFilterValue(filters, "year")
+  const activeSubsidiary = collectFilterValue(filters, "subsidiary")
+  const activeSearch = collectFilterValue(filters, "search") ?? ""
+
+  useEffect(() => {
+    filtersForm.setFieldsValue({
+      year: activeYear,
+      subsidiary: activeSubsidiary,
+      search: activeSearch,
+    })
+  }, [filtersForm, activeYear, activeSubsidiary, activeSearch])
+
+  const debouncedSearch = useMemo(
+    () =>
+      debounce((value: string | undefined) => {
+        setCurrentPage(1)
+        setFilters((previous: any[]) => {
+          const base = (previous ?? []).filter(
+            (entry: any) => !(entry && typeof entry === "object" && entry.field === "search"),
+          )
+          if (!value || value.trim().length === 0) {
+            return base
+          }
+          return [
+            ...base,
+            { field: "search", operator: "contains", value: value.trim() },
+          ]
+        })
+      }, 400),
+    [setFilters, setCurrentPage],
+  )
+
+  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])
+
+  const updateFilter = (field: string, value: string | undefined) => {
+    setCurrentPage(1)
+    setFilters((previous: any[]) => {
+      const base = (previous ?? []).filter(
+        (entry: any) => !(entry && typeof entry === "object" && entry.field === field),
+      )
+      if (!value || value.trim().length === 0) {
+        return base
+      }
+      return [...base, { field, operator: field === "search" ? "contains" : "eq", value }]
+    })
+  }
+
+  const handleYearChange = (value: string | undefined) => {
+    updateFilter("year", value)
+  }
+
+  const handleSubsidiaryChange = (value: string | undefined) => {
+    updateFilter("subsidiary", value)
+  }
+
+  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
+    debouncedSearch(event.target.value)
+  }
+
+  const handleViewDetails = useCallback((record: ProjectRow) => {
+    setActiveProject(record)
+    setIsDrawerOpen(true)
+  }, [setActiveProject, setIsDrawerOpen])
+
+  const handleCloseDrawer = useCallback(() => {
+    setIsDrawerOpen(false)
+    setActiveProject(null)
+  }, [setActiveProject, setIsDrawerOpen])
+
+  const columns = useMemo(() => {
+    return [
+      {
+        key: "project",
+        title: <span style={tableHeadingStyle}>Project</span>,
+        dataIndex: "projectNumber",
+        sorter: true,
+        render: (_: unknown, record: ProjectRow) => (
+          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
+            <span style={{ ...tableCellStyle, fontSize: 16 }}>{stringOrNA(record.projectNumber)}</span>
+            <span style={{ ...tableCellStyle, fontSize: 13, color: "#475569" }}>
+              {stringOrNA(record.projectTitle)}
+            </span>
+          </div>
+        ),
+      },
+      {
+        key: "clientCompany",
+        title: <span style={tableHeadingStyle}>Client Company</span>,
+        dataIndex: "clientCompany",
+        sorter: true,
+        render: (value: string | null) => <span style={tableCellStyle}>{stringOrNA(value)}</span>,
+      },
+      {
+        key: "amount",
+        title: <span style={tableHeadingStyle}>Amount</span>,
+        dataIndex: "amount",
+        sorter: true,
+        align: "right" as const,
+        render: (value: number | null) => (
+          <span style={{ ...tableCellStyle, fontVariantNumeric: "tabular-nums" }}>{amountText(value)}</span>
+        ),
+      },
+      {
+        key: "projectDate",
+        title: <span style={tableHeadingStyle}>Project Date</span>,
+        dataIndex: "projectDateDisplay",
+        sorter: true,
+        render: (_: string | null, record: ProjectRow) => (
+          <span style={tableCellStyle}>{record.projectDateDisplay ?? "-"}</span>
+        ),
+      },
+      {
+        key: "paid",
+        title: <span style={tableHeadingStyle}>Paid</span>,
+        dataIndex: "paid",
+        sorter: true,
+        render: (value: boolean | null, record: ProjectRow) => (
+          <Tag color={paidStatusColor(value)} style={{ ...tableCellStyle, borderRadius: 999 }}>
+            {paidStatusText(record.paid)}
+          </Tag>
+        ),
+      },
+      {
+        key: "subsidiary",
+        title: <span style={tableHeadingStyle}>Subsidiary</span>,
+        dataIndex: "subsidiary",
+        sorter: true,
+        render: (value: string | null) => <span style={tableCellStyle}>{stringOrNA(value)}</span>,
+      },
+      {
+        key: "actions",
+        title: <span style={tableHeadingStyle}>Actions</span>,
+        dataIndex: "actions",
+        render: (_: unknown, record: ProjectRow) => (
+          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetails(record)}>
+            View
+          </Button>
+        ),
+      },
+    ]
+  }, [handleViewDetails])
+
+  const yearOptions = availableYears.map((year) => ({ label: year, value: year }))
+  const subsidiaryOptions = availableSubsidiaries.map((value) => ({ label: value, value }))
+
+  useEffect(() => {
+    if (tableQuery?.error) {
+      const messageText =
+        tableQuery.error instanceof Error ? tableQuery.error.message : "Failed to load projects"
+      message.error(messageText)
+    }
+  }, [message, tableQuery?.error])
+
+  return (
+    <div
+      style={{
+        padding: screens.md ? "32px 0 32px 24px" : "24px 16px",
+        minHeight: "100%",
+        background: "#fff",
+      }}
+    >
+      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
+        <div>
+          <Title level={2} style={{ fontFamily: "'Cantata One'", marginBottom: 8 }}>
+            Projects
+          </Title>
+          <Text style={{ fontFamily: "'Newsreader'", fontWeight: 400, color: "#475569" }}>
+            Review project activity by year, subsidiary, and payment status.
+          </Text>
+        </div>
+        <Form
+          form={filtersForm}
+          layout={screens.md ? "inline" : "vertical"}
+          style={{ width: "100%", rowGap: screens.md ? 16 : 12 }}
+        >
+          <Form.Item name="year" label="Year" style={{ marginBottom: screens.md ? 0 : 12 }}>
+            <Select
+              allowClear
+              placeholder="All years"
+              options={yearOptions}
+              onChange={(value) => handleYearChange(value ?? undefined)}
+              style={{ minWidth: 160 }}
+            />
+          </Form.Item>
+          <Form.Item
+            name="subsidiary"
+            label="Subsidiary"
+            style={{ marginBottom: screens.md ? 0 : 12 }}
+          >
+            <Select
+              allowClear
+              placeholder="All subsidiaries"
+              options={subsidiaryOptions}
+              onChange={(value) => handleSubsidiaryChange(value ?? undefined)}
+              style={{ minWidth: 200 }}
+            />
+          </Form.Item>
+          <Form.Item name="search" label="Search" style={{ marginBottom: 0, flex: 1 }}>
+            <Input
+              allowClear
+              prefix={<SearchOutlined />}
+              placeholder="Search by project, client, or invoice"
+              onChange={handleSearchChange}
+            />
+          </Form.Item>
+        </Form>
+        <Table<ProjectRow>
+          {...tableProps}
+          rowKey="id"
+          columns={columns}
+          pagination={{ ...tableProps.pagination, showSizeChanger: false }}
+        />
+      </div>
+      <ProjectDetailsDrawer project={activeProject} open={isDrawerOpen} onClose={handleCloseDrawer} />
+    </div>
+  )
+}
+
+const ProjectsApp = () => (
+  <AppShell
+    dataProvider={refineDataProvider}
+    resources={[
+      { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
+      {
+        name: "projects",
+        list: "/dashboard/new-ui/projects",
+        meta: { label: "Projects" },
+      },
+    ]}
+    allowedMenuKeys={ALLOWED_MENU_KEYS}
+  >
+    <ProjectsContent />
+  </AppShell>
+)
+
+export default ProjectsApp
diff --git a/next.config.ts b/next.config.ts
index 0803830..ce7861d 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -1,7 +1,10 @@
 import path from "path";
 import type { NextConfig } from "next";
 
-const CLASSNAMES_FRAGMENT = "/antd/node_modules/classnames/index.js";
+const CLASSNAMES_FRAGMENTS = [
+  "/antd/node_modules/classnames/index.js",
+  "/rc-pagination/node_modules/classnames/index.js",
+];
 
 const config: NextConfig = {
   eslint: {
@@ -35,7 +38,9 @@ const config: NextConfig = {
     webpackConfig.module.rules = webpackConfig.module.rules ?? [];
     webpackConfig.module.rules.push({
       test: (resource: string) =>
-        resource.replace(/\\/g, "/").endsWith(CLASSNAMES_FRAGMENT),
+        CLASSNAMES_FRAGMENTS.some((fragment) =>
+          resource.replace(/\\/g, "/").endsWith(fragment),
+        ),
       enforce: "post",
       use: [
         {
diff --git a/pages/api/projects/index.ts b/pages/api/projects/index.ts
new file mode 100644
index 0000000..c104451
--- /dev/null
+++ b/pages/api/projects/index.ts
@@ -0,0 +1,82 @@
+import type { NextApiRequest, NextApiResponse } from "next"
+import { getServerSession } from "next-auth/next"
+
+import { fetchProjectsFromDatabase } from "../../../lib/projectsDatabase"
+import { getAuthOptions } from "../auth/[...nextauth]"
+
+const isNonEmptyString = (value: unknown): value is string =>
+  typeof value === "string" && value.trim().length > 0
+
+const normalizeQueryValue = (value: string | string[] | undefined) => {
+  if (Array.isArray(value)) {
+    return value[0]
+  }
+  return value
+}
+
+export default async function handler(req: NextApiRequest, res: NextApiResponse) {
+  if (req.method !== "GET") {
+    res.setHeader("Allow", "GET")
+    return res.status(405).json({ error: "Method Not Allowed" })
+  }
+
+  const authOptions = await getAuthOptions()
+  const session = await getServerSession(req, res, authOptions)
+
+  if (!session?.user) {
+    return res.status(401).json({ error: "Unauthorized" })
+  }
+
+  const rawYear = normalizeQueryValue(req.query.year)
+  const rawSubsidiary = normalizeQueryValue(req.query.subsidiary)
+  const year = isNonEmptyString(rawYear) ? rawYear.trim() : null
+  const subsidiary = isNonEmptyString(rawSubsidiary) ? rawSubsidiary.trim() : null
+
+  try {
+    const identity = session.user.email ?? session.user.name ?? "unknown"
+    const normalizedSubsidiary = subsidiary ? subsidiary.toLowerCase() : null
+    console.info("[api/projects] GET request received", {
+      user: identity,
+      filters: {
+        year: year ?? null,
+        subsidiary: normalizedSubsidiary ?? null,
+      },
+    })
+
+    const { projects, years } = await fetchProjectsFromDatabase()
+
+    const filtered = projects.filter((project) => {
+      if (year && project.year !== year) {
+        return false
+      }
+      if (normalizedSubsidiary) {
+        const candidate = project.subsidiary?.trim().toLowerCase() ?? ""
+        if (candidate !== normalizedSubsidiary) {
+          return false
+        }
+      }
+      return true
+    })
+
+    console.info("[api/projects] Responding to GET request", {
+      user: identity,
+      total: filtered.length,
+      filters: {
+        year: year ?? null,
+        subsidiary: normalizedSubsidiary ?? null,
+      },
+    })
+
+    return res.status(200).json({ data: filtered, total: filtered.length, years })
+  } catch (error) {
+    console.error("[api/projects] Failed to respond to GET request", {
+      error:
+        error instanceof Error
+          ? { message: error.message, stack: error.stack }
+          : { message: "Unknown error", raw: error },
+    })
+    return res
+      .status(500)
+      .json({ error: error instanceof Error ? error.message : "Failed to load projects" })
+  }
+}
diff --git a/pages/dashboard/new-ui/index.tsx b/pages/dashboard/new-ui/index.tsx
index 7248a61..c8dcf1f 100644
--- a/pages/dashboard/new-ui/index.tsx
+++ b/pages/dashboard/new-ui/index.tsx
@@ -33,6 +33,9 @@ export default function NewUIScreen() {
           <Link href="/dashboard/new-ui/client-accounts" passHref>
             <Button variant="contained">Preview Client Accounts</Button>
           </Link>
+          <Link href="/dashboard/new-ui/projects" passHref>
+            <Button variant="contained">Preview Projects</Button>
+          </Link>
           <Link href="/" passHref>
             <Button variant="outlined">Back to Legacy UI</Button>
           </Link>
diff --git a/pages/dashboard/new-ui/projects.tsx b/pages/dashboard/new-ui/projects.tsx
new file mode 100644
index 0000000..7c67789
--- /dev/null
+++ b/pages/dashboard/new-ui/projects.tsx
@@ -0,0 +1,65 @@
+import Head from "next/head"
+import dynamic from "next/dynamic"
+import type { GetServerSideProps } from "next"
+import { getSession } from "next-auth/react"
+
+const ProjectsApp = dynamic(
+  () => import("../../../components/projects/NewUIProjectsApp"),
+  { ssr: false },
+)
+
+export default function ProjectsPage() {
+  return (
+    <>
+      <Head>
+        <title>Projects · Refine Preview</title>
+      </Head>
+      <ProjectsApp />
+    </>
+  )
+}
+
+export const getServerSideProps: GetServerSideProps = async (ctx) => {
+  const headers = (ctx.req?.headers ?? {}) as Record<string, string | string[] | undefined>
+  const vercelHeader = headers["x-vercel-id"]
+  const hostHeader = headers.host
+  const requestContext = {
+    method: ctx.req?.method ?? "GET",
+    url: ctx.req?.url ?? "",
+    host: Array.isArray(hostHeader) ? hostHeader.join(",") : hostHeader ?? null,
+    vercelId: Array.isArray(vercelHeader) ? vercelHeader.join(",") : vercelHeader ?? null,
+  }
+
+  console.info("[projects] getServerSideProps invoked", requestContext)
+
+  try {
+    const session = await getSession(ctx)
+
+    if (!session?.user) {
+      console.warn("[projects] No authenticated session, redirecting", requestContext)
+      return {
+        redirect: {
+          destination: "/api/auth/signin",
+          permanent: false,
+        },
+      }
+    }
+
+    const identity = session.user.email ?? session.user.name ?? "unknown"
+    console.info("[projects] Authenticated session detected", {
+      ...requestContext,
+      user: identity,
+    })
+
+    return { props: {} }
+  } catch (error) {
+    console.error("[projects] getServerSideProps failed", {
+      ...requestContext,
+      error:
+        error instanceof Error
+          ? { message: error.message, stack: error.stack }
+          : { message: "Unknown error", raw: error },
+    })
+    throw error
+  }
+}
```
