/**
 * Dashboard App (Ant Design)
 *
 * Main dashboard with navigation cards for all major sections.
 */

import React from "react"
import { useRouter } from "next/router"
import { navigateWithModifier } from "../../lib/navigation"
import AppShell from "../layout/AppShell"
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Statistic,
} from "antd"
import {
  TeamOutlined,
  ProjectOutlined,
  BankOutlined,
  ReadOutlined,
  ToolOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons"

const { Title, Text, Paragraph } = Typography

interface DashboardCard {
  key: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  color: string
  stats?: { label: string; value: string | number }[]
}

const dashboardCards: DashboardCard[] = [
  {
    key: "client-accounts",
    title: "Client Accounts",
    description: "Manage client directory, company profiles, and contact information.",
    icon: <TeamOutlined style={{ fontSize: 48 }} />,
    href: "/client-accounts",
    color: "#1890ff",
    stats: [
      { label: "Active Clients", value: "—" },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    description: "Track ongoing projects, milestones, and deliverables.",
    icon: <ProjectOutlined style={{ fontSize: 48 }} />,
    href: "/projects",
    color: "#52c41a",
    stats: [
      { label: "Active Projects", value: "—" },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    description: "Manage banking integrations, payments, and financial records.",
    icon: <BankOutlined style={{ fontSize: 48 }} />,
    href: "/finance",
    color: "#722ed1",
    stats: [
      { label: "Pending Invoices", value: "—" },
    ],
  },
  {
    key: "coaching-sessions",
    title: "Coaching Sessions",
    description: "Schedule and track coaching sessions with students.",
    icon: <ReadOutlined style={{ fontSize: 48 }} />,
    href: "/coaching-sessions",
    color: "#fa8c16",
    stats: [
      { label: "Active Students", value: "—" },
    ],
  },
  {
    key: "tools",
    title: "Tools",
    description: "Development utilities including Invoice Previewer and testing tools.",
    icon: <ToolOutlined style={{ fontSize: 48 }} />,
    href: "/tools",
    color: "#13c2c2",
  },
]

// Data provider for Refine (stub - this page doesn't use Refine data features)
const dataProvider = {
  getList: async () => ({ data: [] as any[], total: 0 }),
  getOne: async () => ({ data: {} as any }),
  create: async () => ({ data: {} as any }),
  update: async () => ({ data: {} as any }),
  deleteOne: async () => ({ data: {} as any }),
  getApiUrl: () => "",
}

export default function DashboardApp() {
  const router = useRouter()

  const handleCardClick = (event: React.MouseEvent, href: string) => {
    navigateWithModifier(event, href, router)
  }

  return (
    <AppShell
      dataProvider={dataProvider}
      resources={[
        { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
        { name: "client-directory", list: "/client-accounts", meta: { label: "Client Accounts" } },
        { name: "projects", list: "/projects", meta: { label: "Projects" } },
        { name: "finance", list: "/finance", meta: { label: "Finance" } },
        { name: "accounting", list: "/accounting", meta: { label: "Accounting" } },
        { name: "coaching-sessions", list: "/coaching-sessions", meta: { label: "Coaching Sessions" } },
        { name: "tools", list: "/tools", meta: { label: "Tools" } },
      ]}
      allowedMenuKeys={["dashboard", "client-directory", "projects", "finance", "accounting", "coaching-sessions", "tools"]}
    >
      <div style={{ padding: 32 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0, marginBottom: 8 }}>Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Welcome to The Establisher management system. Select a section to get started.
          </Text>
        </div>

        {/* Dashboard Cards */}
        <Row gutter={[24, 24]}>
          {dashboardCards.map((card) => (
            <Col key={card.key} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={(e) => handleCardClick(e, card.href)}
                style={{
                  height: "100%",
                  minHeight: 240,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
                bodyStyle={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  padding: 24,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 16,
                    backgroundColor: card.color + "15",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                    color: card.color,
                  }}
                >
                  {card.icon}
                </div>

                <Title level={4} style={{ marginBottom: 8, marginTop: 0 }}>
                  {card.title}
                </Title>

                <Paragraph
                  type="secondary"
                  style={{ flex: 1, marginBottom: 16 }}
                  ellipsis={{ rows: 2 }}
                >
                  {card.description}
                </Paragraph>

                {card.stats && (
                  <div style={{ marginBottom: 16 }}>
                    <Space size={24}>
                      {card.stats.map((stat, idx) => (
                        <Statistic
                          key={idx}
                          title={stat.label}
                          value={stat.value}
                          valueStyle={{ fontSize: 20, fontWeight: 600 }}
                        />
                      ))}
                    </Space>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: card.color,
                    fontWeight: 600,
                  }}
                >
                  <span>Open</span>
                  <ArrowRightOutlined />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </AppShell>
  )
}
