import { useMemo, useState, type ReactNode } from "react"
import {
  Refine,
  useMenu,
  type DataProvider,
  type IResourceItem,
} from "@refinedev/core"
import routerProvider from "@refinedev/nextjs-router"
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Drawer,
  Grid,
  Layout,
  Menu,
  Space,
  Tooltip,
  Typography,
} from "antd"
import {
  ApartmentOutlined,
  AppstoreOutlined,
  BankOutlined,
  CalendarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProjectOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltFilled,
  UnorderedListOutlined,
  BellOutlined,
} from "@ant-design/icons"

type NavigationItem = {
  key: string
  icon: ReactNode
  label: ReactNode
  route: string
}

type AppShellProps = {
  children: ReactNode
  dataProvider: DataProvider
  resources: IResourceItem[]
  allowedMenuKeys?: ReadonlyArray<string>
}

const { Header, Content, Sider } = Layout
const { Text } = Typography

const HEADER_HEIGHT = 64
const HEADER_HORIZONTAL_PADDING = 24

const iconForMenu = (name: string) => {
  switch (name) {
    case "dashboard":
      return <AppstoreOutlined />
    case "calendar":
      return <CalendarOutlined />
    case "scrumboard":
      return <AppstoreOutlined />
    case "companies":
      return <ApartmentOutlined />
    case "client-directory":
      return <TeamOutlined />
    case "projects":
      return <ProjectOutlined />
    case "finance":
      return <BankOutlined />
    case "quotes":
      return <SettingOutlined />
    case "administration":
      return <SettingOutlined />
    default:
      return <UnorderedListOutlined />
  }
}

type NavigationSiderProps = {
  collapsed: boolean
  onCollapse: (value: boolean) => void
  allowedMenuKeys: ReadonlySet<string>
  isMobile: boolean
}

const NavigationSider = ({
  collapsed,
  onCollapse,
  allowedMenuKeys,
  isMobile,
}: NavigationSiderProps) => {
  const { menuItems, selectedKey } = useMenu()

  const navigationItems = useMemo(() => {
    return menuItems
      .filter((item) => allowedMenuKeys.has((item.name as string | undefined) ?? ""))
      .map((item) => {
        const key = item.key ?? item.name
        const route = item.route ?? item.list
        if (!route) {
          return null
        }
        return {
          key: String(key ?? ""),
          icon: iconForMenu(String(item.name ?? "")),
          label: item.label,
          route,
        }
      })
      .filter(Boolean) as NavigationItem[]
  }, [allowedMenuKeys, menuItems])

  const menuEntries = useMemo(
    () =>
      navigationItems.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    [navigationItems],
  )

  const handleMenuClick = (event: { key: string }) => {
    const target = navigationItems.find((item) => item.key === event.key)
    if (target?.route && typeof window !== "undefined") {
      window.location.href = target.route
    }
  }

  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
          borderBottom: "1px solid #e5e7eb",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <Avatar shape="square" size={36} style={{ backgroundColor: "#2563eb" }}>
            <ThunderboltFilled />
          </Avatar>
          {!collapsed ? (
            <Text
              strong
              style={{
                fontSize: 18,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              The Establishers
            </Text>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Menu
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          onClick={handleMenuClick}
          style={{
            flex: 1,
            borderInlineEnd: "none",
            paddingTop: 16,
          }}
          items={menuEntries}
        />
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: 16,
            display: isMobile ? "none" : "flex",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => onCollapse(!collapsed)}
            style={{
              fontFamily: "'Karla', sans-serif",
              fontWeight: 600,
            }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </Button>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        <Button
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          type="text"
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 1300,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          }}
          onClick={() => onCollapse(!collapsed)}
        />
        <Drawer placement="left" open={!collapsed} onClose={() => onCollapse(true)} width={256} bodyStyle={{ padding: 0 }}>
          {content}
        </Drawer>
      </>
    )
  }

  return (
    <Sider
      width={256}
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      style={{
        background: "#fff",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      {content}
    </Sider>
  )
}

const TopHeader = ({
  collapsed,
  onToggle,
  isMobile,
}: {
  collapsed: boolean
  onToggle: () => void
  isMobile: boolean
}) => (
  <Header
    style={{
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
      position: "sticky",
      top: 0,
      zIndex: 1000,
      height: HEADER_HEIGHT,
      borderBottom: "1px solid #e5e7eb",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {!isMobile ? (
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
      ) : null}
    </div>
    <Space size="large" align="center">
      <Tooltip title="Notifications">
        <Badge dot>
          <Button type="text" shape="circle" icon={<BellOutlined />} />
        </Badge>
      </Tooltip>
      <Avatar style={{ backgroundColor: "#1e3a8a", color: "#fff" }}>TE</Avatar>
    </Space>
  </Header>
)

const themeConfig = {
  token: {
    colorPrimary: "#2563eb",
    borderRadius: 10,
    fontFamily: "'Karla', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Button: {
      fontWeight: 600,
      borderRadius: 999,
    },
  },
} as const

const AppShell = ({
  children,
  dataProvider,
  resources,
  allowedMenuKeys,
}: AppShellProps) => {
  const [collapsed, setCollapsed] = useState(true)
  const screens = Grid.useBreakpoint()
  const isMobile = typeof screens.lg === "undefined" ? false : !screens.lg

  const allowedKeys = useMemo(() => {
    if (allowedMenuKeys && allowedMenuKeys.length > 0) {
      return new Set(allowedMenuKeys)
    }
    return new Set(
      resources
        .map((resource) => resource.name)
        .filter((name): name is string => typeof name === "string")
        .map((name) => name),
    )
  }, [allowedMenuKeys, resources])

  return (
    <ConfigProvider theme={themeConfig}>
      <AntdApp>
        <Refine
          dataProvider={dataProvider}
          routerProvider={routerProvider}
          resources={resources}
          options={{ syncWithLocation: false }}
        >
          <Layout style={{ minHeight: "100vh", background: "#fff" }}>
            <NavigationSider
              collapsed={collapsed}
              onCollapse={setCollapsed}
              allowedMenuKeys={allowedKeys}
              isMobile={isMobile}
            />
            <Layout style={{ background: "#fff" }}>
              <TopHeader collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} isMobile={isMobile} />
              <Content>{children}</Content>
            </Layout>
          </Layout>
        </Refine>
      </AntdApp>
    </ConfigProvider>
  )
}

export default AppShell
