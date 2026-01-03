import { useEffect, useMemo, useState, useCallback, type ReactNode, type MouseEvent } from "react"
import { navigateWithModifier } from "../../lib/navigation"
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
  Space,
  Tooltip,
  Typography,
} from "antd"
import {
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  CalculatorOutlined,
  ContainerOutlined,
  DashboardOutlined,
  DownOutlined,
  FundOutlined,
  LockOutlined,
  PhoneOutlined,
  ScheduleOutlined,
  ThunderboltFilled,
  ToolOutlined,
  UnlockOutlined,
  UnorderedListOutlined,
  BellOutlined,
  HolderOutlined,
  MenuOutlined,
} from "@ant-design/icons"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ============================================================================
// Types
// ============================================================================

type TabOrderItem = {
  key: string
  parent?: string // e.g., "finance" for sub-items
}

type NavigationItem = {
  key: string
  icon: ReactNode
  label: string
  route?: string
  children?: { key: string; icon: ReactNode; label: string; route: string }[]
}

type AppShellProps = {
  children: ReactNode
  dataProvider: DataProvider
  resources: IResourceItem[]
  allowedMenuKeys?: ReadonlyArray<string>
}

// ============================================================================
// Constants
// ============================================================================

const { Header, Content, Sider } = Layout
const { Text } = Typography

const HEADER_HEIGHT = 64
const HEADER_HORIZONTAL_PADDING = 24
const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"
const SIDEBAR_ORDER_KEY = "sidebar-tab-order"

// Default tab order
const DEFAULT_TAB_ORDER: TabOrderItem[] = [
  { key: "dashboard" },
  { key: "projects" },
  { key: "coaching" },
  { key: "bank" },
  { key: "bank-access", parent: "bank" },
  { key: "accounting", parent: "bank" },
  { key: "client-directory" },
  { key: "file-archive" },
  { key: "gadgets" },
  { key: "tools" },
]

// Label mappings (override resource labels)
const LABEL_OVERRIDES: Record<string, string> = {
  "coaching": "Coaching",
  "client-directory": "Client Accounts",
  "file-archive": "File Archive",
  "gadgets": "Gadget",
}

// ============================================================================
// Icon Helper
// ============================================================================

const iconForMenu = (name: string): ReactNode => {
  switch (name) {
    case "dashboard":
      return <DashboardOutlined />
    case "projects":
      return <ContainerOutlined />
    case "coaching":
      return <ScheduleOutlined />
    case "bank":
      return <FundOutlined />
    case "bank-access":
      return <BankOutlined />
    case "accounting":
      return <AuditOutlined />
    case "client-directory":
      return <PhoneOutlined />
    case "file-archive":
      return <BookOutlined />
    case "gadgets":
      return <CalculatorOutlined />
    case "tools":
      return <ToolOutlined />
    default:
      return <UnorderedListOutlined />
  }
}

// ============================================================================
// localStorage Helpers (Migration-Ready)
// ============================================================================

const getInitialCollapsed = (): boolean => {
  if (typeof window === "undefined") return true
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved !== null ? JSON.parse(saved) : true
  } catch {
    return true
  }
}

const getSavedTabOrder = (): TabOrderItem[] => {
  if (typeof window === "undefined") return DEFAULT_TAB_ORDER
  try {
    const saved = localStorage.getItem(SIDEBAR_ORDER_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Validate structure
      if (Array.isArray(parsed) && parsed.every((item: any) => typeof item.key === "string")) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_TAB_ORDER
}

const saveTabOrder = (order: TabOrderItem[]): void => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order))
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Sortable Menu Item Component
// ============================================================================

interface SortableMenuItemProps {
  id: string
  icon: ReactNode
  label: string
  isSelected: boolean
  isUnlocked: boolean
  collapsed: boolean
  isSubItem?: boolean
  hasChildren?: boolean
  isExpanded?: boolean
  onClick: () => void
  onToggleExpand?: () => void
}

const SortableMenuItem: React.FC<SortableMenuItemProps> = ({
  id,
  icon,
  label,
  isSelected,
  isUnlocked,
  collapsed,
  isSubItem,
  hasChildren,
  isExpanded,
  onClick,
  onToggleExpand,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isUnlocked })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`sidebar-menu-item ${isSelected ? "selected" : ""} ${isSubItem ? "sub-item" : ""}`}
      onClick={onClick}
    >
      {isUnlocked && !collapsed && (
        <span className="drag-handle" {...listeners}>
          <HolderOutlined />
        </span>
      )}
      <span className="menu-icon">{icon}</span>
      {!collapsed && (
        <>
          <span className="menu-label">{label}</span>
          {hasChildren && (
            <span
              className="expand-arrow"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand?.()
              }}
            >
              <DownOutlined style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                fontSize: 12,
              }} />
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// Navigation Sider Component
// ============================================================================

type NavigationSiderProps = {
  collapsed: boolean
  onCollapse: (value: boolean) => void
  allowedMenuKeys: ReadonlySet<string>
  isMobile: boolean
  autoExpandedFor: string | null
  setAutoExpandedFor: (value: string | null) => void
  mounted: boolean
  tabOrder: TabOrderItem[]
  onTabOrderChange: (order: TabOrderItem[]) => void
  isUnlocked: boolean
  onUnlockedChange: (value: boolean) => void
}

const NavigationSider = ({
  collapsed,
  onCollapse,
  allowedMenuKeys,
  isMobile,
  autoExpandedFor,
  setAutoExpandedFor,
  mounted,
  tabOrder,
  onTabOrderChange,
  isUnlocked,
  onUnlockedChange,
}: NavigationSiderProps) => {
  const { menuItems, selectedKey } = useMenu()
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  // Build navigation items based on tab order
  const navigationItems = useMemo(() => {
    const items: NavigationItem[] = []
    const processedKeys = new Set<string>()

    // Process items in tab order
    for (const orderItem of tabOrder) {
      if (orderItem.parent) continue // Skip sub-items, they'll be added to parent

      const key = orderItem.key

      // Check if this item has children in tabOrder
      const childItems = tabOrder.filter((item) => item.parent === key)

      // Special handling for bank with sub-menu
      if (key === "bank" && childItems.length > 0) {
        if (allowedMenuKeys.has("bank")) {
          const children = childItems.map((child) => ({
            key: child.key,
            icon: iconForMenu(child.key),
            label: LABEL_OVERRIDES[child.key] || (child.key === "bank-access" ? "Bank Access" : "Accounting"),
            route: child.key === "bank-access" ? "/bank" : "/accounting",
          }))

          items.push({
            key: "bank",
            icon: iconForMenu("bank"),
            label: "Finance",
            children,
          })
          processedKeys.add("bank")
          childItems.forEach((c) => processedKeys.add(c.key))
        }
        continue
      }

      // Regular items
      if (!allowedMenuKeys.has(key)) continue

      const menuItem = menuItems.find((m) => m.name === key)
      if (!menuItem) continue

      const route = menuItem.route ?? menuItem.list
      if (!route) continue

      items.push({
        key,
        icon: iconForMenu(key),
        label: LABEL_OVERRIDES[key] || String(menuItem.label || key),
        route: String(route),
      })
      processedKeys.add(key)
    }

    // Add any items from menuItems that weren't in tabOrder
    for (const item of menuItems) {
      const key = String(item.name || "")
      if (processedKeys.has(key) || !allowedMenuKeys.has(key)) continue
      if (key === "accounting") continue // Accounting is handled as sub-menu

      const route = item.route ?? item.list
      if (!route) continue

      items.push({
        key,
        icon: iconForMenu(key),
        label: LABEL_OVERRIDES[key] || String(item.label || key),
        route: String(route),
      })
    }

    return items
  }, [tabOrder, allowedMenuKeys, menuItems])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tabOrder.findIndex((item) => item.key === active.id)
    const newIndex = tabOrder.findIndex((item) => item.key === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const activeItem = tabOrder[oldIndex]
      const overItem = tabOrder[newIndex]

      // Only allow reordering within same level (both top-level or both same parent)
      if (activeItem.parent === overItem.parent) {
        const newOrder = arrayMove(tabOrder, oldIndex, newIndex)
        onTabOrderChange(newOrder)
      }
    }
  }

  const handleItemClick = (item: NavigationItem, e: MouseEvent<HTMLDivElement>) => {
    // If unlocked, don't navigate
    if (isUnlocked) return

    // If collapsed, expand sidebar
    if (collapsed) {
      onCollapse(false)
      setAutoExpandedFor("manual")
      return
    }

    // If has children, toggle expansion (don't navigate)
    if (item.children && item.children.length > 0) {
      setExpandedKeys((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(item.key)) {
          newSet.delete(item.key)
        } else {
          newSet.add(item.key)
        }
        return newSet
      })
      return
    }

    // Navigate
    if (item.route) {
      navigateWithModifier(e as any, item.route)
      if (autoExpandedFor) {
        onCollapse(true)
        setAutoExpandedFor(null)
      }
    }
  }

  const handleChildClick = (child: { key: string; route: string }, e: MouseEvent<HTMLDivElement>) => {
    if (isUnlocked) return

    if (child.route) {
      navigateWithModifier(e as any, child.route)
      if (autoExpandedFor) {
        onCollapse(true)
        setAutoExpandedFor(null)
        setExpandedKeys(new Set())
      }
    }
  }

  // Handle click on sidebar background to expand
  const handleSiderBackgroundClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isUnlocked) return

    // Only expand if clicking the sidebar background (not menu items)
    if (e.target === e.currentTarget && collapsed) {
      onCollapse(false)
      setAutoExpandedFor("manual")
    }
  }

  // Flatten items for sortable context (top-level + visible sub-items)
  const sortableIds = useMemo(() => {
    const ids: string[] = []
    for (const item of navigationItems) {
      ids.push(item.key)
      if (item.children && expandedKeys.has(item.key)) {
        for (const child of item.children) {
          ids.push(child.key)
        }
      }
    }
    return ids
  }, [navigationItems, expandedKeys])

  const content = (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onClick={handleSiderBackgroundClick}
    >
      {/* Header */}
      <div
        style={{
          height: HEADER_HEIGHT,
          minHeight: HEADER_HEIGHT,
          maxHeight: HEADER_HEIGHT,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
          borderBottom: "1px solid #e5e7eb",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, overflow: "hidden" }}>
          <Avatar shape="square" size={36} style={{ backgroundColor: "#2563eb", flexShrink: 0 }}>
            <ThunderboltFilled />
          </Avatar>
          <Text
            strong
            style={{
              fontSize: 18,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? "translateX(-8px)" : "translateX(0)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              pointerEvents: collapsed ? "none" : "auto",
            }}
          >
            The Establishers
          </Text>
        </div>
      </div>

      {/* Menu */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingTop: 16,
        }}
        onClick={handleSiderBackgroundClick}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {navigationItems.map((item) => (
              <div key={item.key}>
                <SortableMenuItem
                  id={item.key}
                  icon={item.icon}
                  label={item.label}
                  isSelected={selectedKey === item.key || (item.children?.some((c) => selectedKey === c.key) ?? false)}
                  isUnlocked={isUnlocked}
                  collapsed={collapsed}
                  hasChildren={!!item.children?.length}
                  isExpanded={expandedKeys.has(item.key)}
                  onClick={() => handleItemClick(item, {} as any)}
                  onToggleExpand={() => {
                    setExpandedKeys((prev) => {
                      const newSet = new Set(prev)
                      if (newSet.has(item.key)) newSet.delete(item.key)
                      else newSet.add(item.key)
                      return newSet
                    })
                  }}
                />
                {/* Sub-items */}
                {item.children && !collapsed && expandedKeys.has(item.key) && (
                  <div className="sub-menu-container">
                    {item.children.map((child) => (
                      <SortableMenuItem
                        key={child.key}
                        id={child.key}
                        icon={child.icon}
                        label={child.label}
                        isSelected={selectedKey === child.key}
                        isUnlocked={isUnlocked}
                        collapsed={collapsed}
                        isSubItem
                        onClick={() => handleChildClick(child, {} as any)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer with Lock Button */}
      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          padding: 16,
          display: isMobile ? "none" : "flex",
          justifyContent: "center",
        }}
      >
        <Tooltip title={isUnlocked ? "Lock sidebar (finish reordering)" : "Unlock to reorder tabs"}>
          <Button
            type="text"
            icon={isUnlocked ? <UnlockOutlined style={{ color: "#faad14" }} /> : <LockOutlined />}
            onClick={() => onUnlockedChange(!isUnlocked)}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </Tooltip>
      </div>

      {/* CSS for menu items */}
      <style jsx global>{`
        .sidebar-menu-item {
          display: flex;
          align-items: center;
          padding: 10px 24px;
          cursor: pointer;
          transition: background-color 0.2s;
          gap: 12px;
          color: rgba(0, 0, 0, 0.88);
        }
        .sidebar-menu-item:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }
        .sidebar-menu-item.selected {
          background-color: #e6f4ff;
          color: #1677ff;
        }
        .sidebar-menu-item.sub-item {
          padding-left: 48px;
        }
        .sidebar-menu-item .drag-handle {
          cursor: grab;
          color: #bfbfbf;
          margin-right: 4px;
        }
        .sidebar-menu-item .drag-handle:hover {
          color: #8c8c8c;
        }
        .sidebar-menu-item .menu-icon {
          font-size: 16px;
          min-width: 16px;
        }
        .sidebar-menu-item .menu-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sidebar-menu-item .expand-arrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          margin-left: auto;
          color: rgba(0, 0, 0, 0.65);
          cursor: pointer;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        .sidebar-menu-item .expand-arrow:hover {
          background-color: rgba(0, 0, 0, 0.06);
          color: rgba(0, 0, 0, 0.85);
        }
        .sub-menu-container {
          background-color: rgba(0, 0, 0, 0.02);
        }
      `}</style>
    </div>
  )

  if (isMobile) {
    return (
      <>
        <Button
          icon={<MenuOutlined />}
          type="text"
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 1300,
          }}
          onClick={() => onCollapse(!collapsed)}
        />
        <Drawer
          placement="left"
          open={!collapsed}
          onClose={() => onCollapse(true)}
          width={256}
          bodyStyle={{ padding: 0 }}
        >
          {content}
        </Drawer>
      </>
    )
  }

  return (
    <Sider
      width={256}
      collapsedWidth={80}
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      style={{
        background: "#fff",
        position: "sticky",
        top: 0,
        height: "100vh",
        opacity: mounted ? 1 : 0,
        transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease",
        borderRight: "1px solid #e5e7eb",
      }}
    >
      {content}
    </Sider>
  )
}

// ============================================================================
// Top Header Component
// ============================================================================

const TopHeader = () => (
  <Header
    style={{
      background: "#fff",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: `0 ${HEADER_HORIZONTAL_PADDING}px`,
      position: "sticky",
      top: 0,
      zIndex: 1000,
      height: HEADER_HEIGHT,
      minHeight: HEADER_HEIGHT,
      maxHeight: HEADER_HEIGHT,
      lineHeight: `${HEADER_HEIGHT}px`,
      borderBottom: "1px solid #e5e7eb",
    }}
  >
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

// ============================================================================
// Theme Configuration
// ============================================================================

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

// ============================================================================
// Main AppShell Component
// ============================================================================

const AppShell = ({
  children,
  dataProvider,
  resources,
  allowedMenuKeys,
}: AppShellProps) => {
  const [collapsed, setCollapsed] = useState(true)
  const [autoExpandedFor, setAutoExpandedFor] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [tabOrder, setTabOrder] = useState<TabOrderItem[]>(DEFAULT_TAB_ORDER)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const screens = Grid.useBreakpoint()
  const isMobile = typeof screens.lg === "undefined" ? false : !screens.lg

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedCollapsed = getInitialCollapsed()
    const savedOrder = getSavedTabOrder()
    setCollapsed(savedCollapsed)
    setTabOrder(savedOrder)
    setMounted(true)
  }, [])

  // Persist collapsed state to localStorage
  const handleCollapse = useCallback((value: boolean) => {
    setCollapsed(value)
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(value))
    }
    if (value) {
      setAutoExpandedFor(null)
    }
  }, [])

  // Persist tab order to localStorage
  const handleTabOrderChange = useCallback((order: TabOrderItem[]) => {
    setTabOrder(order)
    saveTabOrder(order)
  }, [])

  const allowedKeys = useMemo(() => {
    if (allowedMenuKeys && allowedMenuKeys.length > 0) {
      return new Set(allowedMenuKeys)
    }
    return new Set(
      resources
        .map((resource) => resource.name)
        .filter((name): name is string => typeof name === "string")
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
              onCollapse={handleCollapse}
              allowedMenuKeys={allowedKeys}
              isMobile={isMobile}
              autoExpandedFor={autoExpandedFor}
              setAutoExpandedFor={setAutoExpandedFor}
              mounted={mounted}
              tabOrder={tabOrder}
              onTabOrderChange={handleTabOrderChange}
              isUnlocked={isUnlocked}
              onUnlockedChange={setIsUnlocked}
            />
            <Layout
              style={{
                background: "#fff",
                margin: 0,
                position: "relative",
                transition: "margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Modal backdrop for expanded sidebar - clicking collapses it */}
              <div
                onClick={() => {
                  if (!collapsed) {
                    handleCollapse(true)
                    setAutoExpandedFor(null)
                  }
                }}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 256,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0, 0, 0, 0.25)",
                  zIndex: 999,
                  cursor: !collapsed ? "pointer" : "default",
                  opacity: !collapsed ? 1 : 0,
                  pointerEvents: !collapsed ? "auto" : "none",
                  transition: "opacity 0.3s ease",
                }}
              />
              <TopHeader />
              <Content>{children}</Content>
            </Layout>
          </Layout>
        </Refine>
      </AntdApp>
    </ConfigProvider>
  )
}

export default AppShell
