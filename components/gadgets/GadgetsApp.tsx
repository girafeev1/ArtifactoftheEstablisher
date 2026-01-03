/**
 * Gadgets App
 *
 * Contains gadget modules for monitoring and utilities.
 * Primary feature: GCP Usage & Billing card.
 */

import React, { useState, useEffect, useCallback } from "react"
import AppShell from "../layout/AppShell"
import { NAVIGATION_RESOURCES, ALLOWED_MENU_KEYS } from "../../lib/navigation/resources"
import {
  Row,
  Col,
  Card,
  Typography,
  Statistic,
  Space,
  Tag,
  Spin,
  Empty,
  Progress,
  Divider,
  Tooltip,
  Button,
} from "antd"
import {
  GoogleOutlined,
  DollarOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons"

const { Title, Text } = Typography

// Data provider for Refine (stub - this page doesn't use Refine data features)
const dataProvider = {
  getList: async () => ({ data: [] as any[], total: 0 }),
  getOne: async () => ({ data: {} as any }),
  create: async () => ({ data: {} as any }),
  update: async () => ({ data: {} as any }),
  deleteOne: async () => ({ data: {} as any }),
  getApiUrl: () => "",
}

interface GcpBillingData {
  currentMonthCost: number
  projectedMonthCost: number
  budgetLimit: number
  currency: string
  lastUpdated: string
  services: {
    name: string
    cost: number
    percentOfTotal: number
  }[]
  dailyCosts?: { date: string; cost: number }[]
}

const GcpBillingCard = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<GcpBillingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchGcpData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/gcp/billing')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch billing data')
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch GCP data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGcpData()
  }, [fetchGcpData])

  const budgetUsagePercent = data
    ? Math.min((data.currentMonthCost / data.budgetLimit) * 100, 100)
    : 0

  const getBudgetStatus = () => {
    if (budgetUsagePercent >= 90) return { color: "red", icon: <WarningOutlined />, text: "Critical" }
    if (budgetUsagePercent >= 70) return { color: "orange", icon: <WarningOutlined />, text: "Warning" }
    return { color: "green", icon: <CheckCircleOutlined />, text: "Healthy" }
  }

  const budgetStatus = getBudgetStatus()

  return (
    <Card
      title={
        <Space>
          <GoogleOutlined style={{ color: "#4285F4" }} />
          <span style={{ fontWeight: 500 }}>GCP Usage & Billing</span>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="Refresh data">
            <Button
              type="text"
              icon={<SyncOutlined spin={loading} />}
              onClick={fetchGcpData}
              disabled={loading}
            />
          </Tooltip>
          <Tag color={budgetStatus.color} icon={budgetStatus.icon}>
            {budgetStatus.text}
          </Tag>
        </Space>
      }
      style={{ height: "100%" }}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Loading GCP billing data...</Text>
          </div>
        </div>
      ) : error ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Text type="danger">{error}</Text>
              <Button size="small" onClick={fetchGcpData}>
                Retry
              </Button>
            </Space>
          }
        />
      ) : data ? (
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {/* Budget Progress */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <Text>Budget Usage</Text>
              <Text strong>
                ${data.currentMonthCost.toFixed(2)} / ${data.budgetLimit.toFixed(2)}
              </Text>
            </div>
            <Progress
              percent={budgetUsagePercent}
              strokeColor={budgetStatus.color === "green" ? "#52c41a" : budgetStatus.color}
              showInfo={false}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {budgetUsagePercent.toFixed(1)}% of monthly budget used
            </Text>
          </div>

          <Divider style={{ margin: "12px 0" }} />

          {/* Cost Stats */}
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Current Month"
                value={data.currentMonthCost}
                precision={2}
                prefix={<DollarOutlined />}
                suffix={data.currency}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title={
                  <Space>
                    Projected
                    <Tooltip title="Estimated end-of-month cost based on current usage">
                      <InfoCircleOutlined style={{ color: "#8c8c8c" }} />
                    </Tooltip>
                  </Space>
                }
                value={data.projectedMonthCost}
                precision={2}
                prefix={<DollarOutlined />}
                suffix={data.currency}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
          </Row>

          {data.services.length > 0 && (
            <>
              <Divider style={{ margin: "12px 0" }} />

              {/* Service Breakdown */}
              <div>
                <Text strong style={{ marginBottom: 12, display: "block" }}>
                  Top Services
                </Text>
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {data.services.slice(0, 5).map((service) => (
                    <div
                      key={service.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text>{service.name}</Text>
                      <Space>
                        <Text type="secondary">{service.percentOfTotal.toFixed(1)}%</Text>
                        <Text strong>${service.cost.toFixed(2)}</Text>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            </>
          )}

          {/* Last Updated */}
          <div style={{ textAlign: "right" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </Text>
          </div>
        </Space>
      ) : (
        <Empty description="No data available" />
      )}
    </Card>
  )
}

export default function GadgetsApp() {
  return (
    <AppShell
      dataProvider={dataProvider}
      resources={NAVIGATION_RESOURCES}
      allowedMenuKeys={ALLOWED_MENU_KEYS}
    >
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>Gadgets</Title>
          <Text type="secondary">Monitoring and utility modules</Text>
        </div>

        {/* Gadget Cards */}
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12} xl={8}>
            <GcpBillingCard />
          </Col>
          {/* Future gadgets can be added here */}
        </Row>
      </div>
    </AppShell>
  )
}
