/**
 * Finance App - Multi-Provider Banking Dashboard
 * Main component for the Finance tab
 *
 * Supports multiple banking providers (Airwallex, OCBC, etc.)
 * with a unified dashboard interface.
 */

import React, { useState, useEffect, useCallback } from "react"
import {
  Tabs,
  Space,
  Typography,
  Spin,
  Badge,
  Grid,
} from "antd"
import {
  BankOutlined,
} from "@ant-design/icons"
import type { DataProvider, BaseRecord, GetListResponse } from "@refinedev/core"

import AppShell from "../layout/AppShell"
import BankDashboard from "./BankDashboard"
import { BANK_PROVIDERS, type BankProviderId } from "../../lib/banking/types"

// Inline logo components for tabs
const AirwallexTabLogo: React.FC = () => (
  <svg width={100} height={18} viewBox="0 0 175 24" style={{ display: 'block' }}>
    <defs>
      <linearGradient x1="0%" y1="0%" x2="100%" y2="100%" id="awx-tab-gradient">
        <stop stopColor="#FF4244" offset="0%"></stop>
        <stop stopColor="#FF8E3C" offset="100%"></stop>
      </linearGradient>
    </defs>
    <g fill="none" fillRule="evenodd">
      <path d="M34.614 9.421a4.452 4.452 0 0 1 1.057 4.77l-2.347 6.376c-.616 1.674-2.02 2.969-3.755 3.307a4.882 4.882 0 0 1-4.732-1.69L10.763 5.322a.31.31 0 0 0-.528.093L5.656 17.8c-.095.256.157.504.407.402l5.619-2.295a2.481 2.481 0 0 1 3.296 1.546c.415 1.273-.283 2.648-1.512 3.15L6.126 23.6c-1.359.555-2.92.457-4.144-.36a4.461 4.461 0 0 1-1.704-5.26l5.41-14.628C6.329 1.618 7.789.394 9.594.078a5.025 5.025 0 0 1 4.768 1.755l8.078 9.68 7.43-3.035c1.651-.674 3.469-.313 4.744.943zm-4.285 4.862c.094-.256-.158-.504-.408-.401l-4.105 1.676 2.462 2.951a.31.31 0 0 0 .53-.093l1.52-4.133z" fill="url(#awx-tab-gradient)"></path>
      <path d="M150.743 11.045c2.213 0 3.066 1.354 3.185 2.533a.128.128 0 0 1-.128.14h-6.077a.128.128 0 0 1-.127-.144c.164-1.152 1.185-2.529 3.147-2.529zm3.331 7.496a.254.254 0 0 0-.207.105c-.548.772-1.44 1.248-2.772 1.248-1.835 0-3.428-1.206-3.6-2.915a.128.128 0 0 1 .127-.14h10.919c.031-.096.095-.828.095-1.497 0-5.092-3.036-8.116-7.957-8.116-4.122 0-7.925 3.246-7.925 8.339 0 5.316 3.899 8.435 8.277 8.435 3.957 0 6.464-2.214 7.277-4.89.005-.016.032-.116.062-.262a.255.255 0 0 0-.25-.307h-4.046zm9.655-3.057l-5.177-7.38a.255.255 0 0 1 .21-.401h5.09c.087 0 .167.043.215.115l2.66 4.05c.05.077.164.076.214-.002l2.599-4.045a.255.255 0 0 1 .215-.118h4.798c.208 0 .329.233.21.402l-5.108 7.186a.254.254 0 0 0-.001.293c1.672 2.38 3.583 5.13 5.298 7.537.12.169 0 .401-.208.401h-5.055a.256.256 0 0 1-.214-.114l-2.758-4.182a.128.128 0 0 0-.213 0c-.826 1.228-1.906 2.938-2.725 4.182a.255.255 0 0 1-.214.114h-4.712a.254.254 0 0 1-.21-.399l5.087-7.349a.254.254 0 0 0 0-.29zm-27.43 7.784V.733c0-.141.115-.255.256-.255h4.346c.141 0 .256.114.256.255v22.535c0 .14-.115.254-.256.254h-4.346a.255.255 0 0 1-.256-.254zm-7.158 0V.733c0-.141.115-.255.256-.255h4.346c.141 0 .255.114.255.255v22.535c0 .14-.114.254-.255.254h-4.346a.255.255 0 0 1-.256-.254zm-10.748-3.47c1.95 0 3.611-1.527 3.611-4.201 0-2.737-1.63-4.17-3.611-4.17-2.077 0-3.643 1.433-3.643 4.17 0 2.61 1.63 4.202 3.643 4.202zm3.643 1.687c-.703 1.528-2.3 2.483-4.282 2.483-4.666 0-7.893-3.533-7.893-8.403 0-4.71 3.036-8.34 7.733-8.34 2.844 0 4.09 1.56 4.41 2.292v-1.56c0-.14.114-.254.256-.254h4.186c.14 0 .255.114.255.255v15.31c0 .14-.114.254-.255.254h-4.183a.255.255 0 0 1-.255-.258c.008-.575.028-1.904.028-1.779zM99.496 7.878l2.911 8.818c.04.12.21.116.244-.005l2.487-8.802a.255.255 0 0 1 .246-.186h4.22c.173 0 .296.166.245.33l-4.763 15.31a.255.255 0 0 1-.244.18h-4.453a.256.256 0 0 1-.242-.174l-3.27-9.682c-.04-.116-.205-.115-.243 0l-3.21 9.68a.255.255 0 0 1-.242.175h-4.549a.256.256 0 0 1-.244-.178l-4.825-15.31a.255.255 0 0 1 .244-.331h4.508c.114 0 .215.076.246.186l2.487 8.774c.034.12.204.124.244.005l2.942-8.79a.256.256 0 0 1 .243-.175h4.775c.11 0 .209.07.243.175zm-17.25 4.287a.255.255 0 0 1-.299.251 7.027 7.027 0 0 0-1.235-.098c-1.95 0-3.707 1.146-3.707 4.297v6.653c0 .14-.114.254-.255.254h-4.346a.255.255 0 0 1-.256-.254V7.958c0-.14.114-.255.256-.255h4.186c.141 0 .255.114.255.255v1.878c.831-1.783 2.845-2.292 4.123-2.292.388 0 .776.042 1.079.108.117.026.199.13.199.249v4.264zM64.894 23.268V7.958c0-.14.115-.255.256-.255h4.346c.141 0 .256.114.256.255v15.31c0 .14-.115.254-.256.254H65.15a.255.255 0 0 1-.256-.254zM67.291.032c1.598 0 2.876 1.273 2.876 2.833 0 1.56-1.278 2.833-2.876 2.833-1.534 0-2.812-1.273-2.812-2.833 0-1.56 1.278-2.833 2.812-2.833zM49.417 14.355h5.136c.088 0 .15-.086.12-.169L52.137 6.9a.128.128 0 0 0-.242-.001l-2.597 7.287c-.03.082.032.17.12.17zm6.733 4.584h-8.395a.255.255 0 0 0-.24.17l-1.51 4.244a.255.255 0 0 1-.241.17H41.01a.255.255 0 0 1-.24-.345L49.11 1.12a.255.255 0 0 1 .239-.165h5.494c.106 0 .202.066.239.166l8.246 22.058a.255.255 0 0 1-.24.343h-4.947a.256.256 0 0 1-.241-.17l-1.51-4.243a.256.256 0 0 0-.24-.17z" fill="#000"></path>
    </g>
  </svg>
)

// OCBC Tab Logo - circular symbol with rays + "OCBC" text
const OCBCTabLogo: React.FC = () => (
  <svg width={110} height={26} viewBox="0 0 110 26" style={{ display: 'block' }}>
    {/* Circular symbol with rays */}
    <g transform="translate(1, 1) scale(0.054)">
      <path fill="#e30513" d="m209.1 0.7c-36.2 0-70.2 9.8-99.9 26.9l39.4 48.9 28 33.7c11.3-4.1 23.4-6.3 36-6.3 61.4 0 111.2 52.6 111.2 117.4 0 45.7-24.8 85.3-60.9 104.7-2.3 1.4-43 25.6-112.7 25.6l-109.9-0.3c38 54.9 99.5 90.6 168.8 90.6 115.4 0 209-98.8 209-220.6 0-121.8-93.6-220.6-209-220.6zm-165 85.3l84 59c8.7-10.7 19.2-19.8 31-26.7l-72.7-75.5c-16 12.3-30.2 26.8-42.3 43.2zm77.1 121.6l103 41.9v-25.7l-87.7-52.6c-6.9 9.6-12.3 21.6-15.3 36.4zm26.4-48.9l76.6 53.8v-26.7l-44.3-45.9c-11.2 3.9-22.5 9.9-32.3 18.8zm76.6 131.3v-29.6l-105.3-35c-1 17 0.8 37.2 6.2 61 0 0-24-26.3-24.2-67l-98.2-32.6c-1.7 11.2-2.6 22.7-2.6 34.5 0 24 3.7 47 10.4 68.7zm-215.9-129.6l93.4 39.7c2.3-14.6 7.3-28.1 14.4-40.1l-85.4-53.5c-9.6 16.6-17.2 34.8-22.4 53.9zm91.5 143h-84.5c4.4 11.7 9.8 23 16 33.6h150.9l19.3-21.4h-90.8z"/>
    </g>
    {/* OCBC text */}
    <text x="30" y="19" fill="#e30513" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="17" fontWeight="700" letterSpacing="-0.5">OCBC</text>
  </svg>
)

// OCBC Tab Icon - official sun/rays symbol
const OCBCTabIcon: React.FC = () => (
  <svg width={48} height={48} viewBox="0 0 1549 1635" style={{ display: 'block' }}>
    <path fill="#e30513" fillRule="evenodd" d="m1548.7 817.6c0 451.1-346.7 817-774.2 817-256.7 0-484.5-132.2-625.2-335.5l407 1.1c258.2 0 409-89.6 417.5-94.8 133.7-71.9 225.6-218.5 225.6-387.8 0-240-184.5-434.8-411.9-434.8-46.7 0-91.5 8.2-133.4 23.3l-103.7-124.8-145.9-181.1c110-63.3 235.9-99.6 370-99.6 427.5 0 774.2 365.9 774.2 817zm-1228.7-661.1l269.3 279.6c-43.7 25.6-82.6 59.3-114.8 98.9l-311.2-218.5c44.9-60.7 97.5-114.4 156.7-160zm185.6 475.6l324.8 194.8v95.2l-381.5-155.2c11.1-54.8 31.1-99.3 56.7-134.8zm160.8-116l164 170v98.9l-283.7-199.2c36.3-33 78.2-55.2 119.7-69.7zm-627.5 555.9c-24.8-80.3-38.5-165.5-38.5-254.4 0-43.7 3.3-86.3 9.6-127.8l363.7 120.8c0.8 150.7 89.7 248.1 89.7 248.1-20-88.1-26.7-162.9-23-225.9l390 129.6v109.6zm74.9-679.6l316.3 198.2c-26.3 44.4-44.8 94.4-53.3 148.5l-346-147c19.3-70.8 47.4-138.2 83-199.7zm296.3 774.5h336.3l-71.5 79.2h-558.9c-23-39.2-43-81.1-59.3-124.4h313z"/>
  </svg>
)

const { Title, Text } = Typography

// ============================================================================
// Types
// ============================================================================

interface ProviderStatus {
  id: BankProviderId
  connected: boolean
  loading: boolean
}

// ============================================================================
// Data Provider (for AppShell compatibility)
// ============================================================================

const financeDataProvider: DataProvider = {
  getApiUrl: () => "/api",

  getList: async <TData extends BaseRecord = BaseRecord>(): Promise<GetListResponse<TData>> => {
    return { data: [], total: 0 }
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

// ============================================================================
// Finance Content Component
// ============================================================================

const FinanceContent: React.FC = () => {
  const screens = Grid.useBreakpoint()
  const [activeProvider, setActiveProvider] = useState<BankProviderId>("airwallex")
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([])
  const [loading, setLoading] = useState(true)

  // Check connection status for all providers
  const checkProviderStatuses = useCallback(async () => {
    setLoading(true)
    const statuses: ProviderStatus[] = []

    // Check Airwallex
    try {
      const awxResponse = await fetch("/api/airwallex/auth?action=status", {
        credentials: "include",
      })
      const awxData = await awxResponse.json()
      statuses.push({
        id: "airwallex",
        connected: awxData.data?.connected || false,
        loading: false,
      })
    } catch {
      statuses.push({ id: "airwallex", connected: false, loading: false })
    }

    // Check OCBC (when available)
    try {
      const ocbcResponse = await fetch("/api/ocbc/auth?action=status", {
        credentials: "include",
      })
      const ocbcData = await ocbcResponse.json()
      statuses.push({
        id: "ocbc",
        connected: ocbcData.data?.connected || false,
        loading: false,
      })
    } catch {
      statuses.push({ id: "ocbc", connected: false, loading: false })
    }

    setProviderStatuses(statuses)
    setLoading(false)

    // Set active to first connected provider, or default to airwallex
    const connectedProvider = statuses.find(s => s.connected)
    if (connectedProvider) {
      setActiveProvider(connectedProvider.id)
    }
  }, [])

  useEffect(() => {
    checkProviderStatuses()
  }, [checkProviderStatuses])

  const getProviderStatus = (id: BankProviderId): ProviderStatus | undefined => {
    return providerStatuses.find(s => s.id === id)
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Checking bank connections...</Text>
        </div>
      </div>
    )
  }

  // Build tab items
  const tabItems = [
    {
      key: "airwallex",
      label: (
        <Badge dot={getProviderStatus("airwallex")?.connected} color="green" offset={[4, 0]}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px' }}>
            <AirwallexTabLogo />
          </div>
        </Badge>
      ),
      children: <BankDashboard providerId="airwallex" />,
    },
    {
      key: "ocbc",
      label: (
        <Badge dot={getProviderStatus("ocbc")?.connected} color="green" offset={[4, 0]}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px' }}>
            <OCBCTabLogo />
          </div>
        </Badge>
      ),
      children: (
        <div style={{ padding: 24, textAlign: "center" }}>
          <div style={{ marginBottom: 16 }}>
            <OCBCTabIcon />
          </div>
          <Title level={4}>OCBC Integration Coming Soon</Title>
          <Text type="secondary">
            OCBC corporate banking API integration is under development.
            <br />
            Connect your Airwallex account in the meantime.
          </Text>
        </div>
      ),
    },
  ]

  return (
    <div style={{ padding: screens.md ? "0" : "0" }}>
      {/* Header */}
      <div style={{
        padding: screens.md ? "16px 24px" : "12px 16px",
        borderBottom: "1px solid #f0f0f0",
        background: "#fff",
      }}>
        <Title level={3} style={{ margin: 0 }}>
          <BankOutlined style={{ marginRight: 12 }} />
          Finance
        </Title>
      </div>

      {/* Provider Tabs */}
      <Tabs
        activeKey={activeProvider}
        onChange={(key) => setActiveProvider(key as BankProviderId)}
        items={tabItems}
        tabBarStyle={{
          padding: screens.md ? "0 24px" : "0 16px",
          marginBottom: 0,
          background: "#fff",
        }}
        style={{ background: "#f5f5f5", minHeight: "calc(100vh - 200px)" }}
      />
    </div>
  )
}

// ============================================================================
// App Shell Wrapper
// ============================================================================

const ALLOWED_MENU_KEYS = ["dashboard", "client-directory", "projects", "finance", "accounting", "coaching-sessions", "tools"] as const

const FinanceApp: React.FC = () => {
  return (
    <AppShell
      dataProvider={financeDataProvider}
      resources={[
        { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
        {
          name: "client-directory",
          list: "/client-accounts",
          meta: { label: "Client Accounts" },
        },
        {
          name: "projects",
          list: "/projects",
          meta: { label: "Projects" },
        },
        {
          name: "finance",
          list: "/finance",
          meta: { label: "Finance" },
        },
        {
          name: "accounting",
          list: "/accounting",
          meta: { label: "Accounting" },
        },
        {
          name: "coaching-sessions",
          list: "/coaching-sessions",
          meta: { label: "Coaching Sessions" },
        },
        {
          name: "tools",
          list: "/tools",
          meta: { label: "Tools" },
        },
      ]}
      allowedMenuKeys={ALLOWED_MENU_KEYS}
    >
      <FinanceContent />
    </AppShell>
  )
}

export default FinanceApp
