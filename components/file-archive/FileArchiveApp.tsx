/**
 * File Archive App
 *
 * Standalone page for viewing and managing documents (receipts, invoice PDFs, contracts, etc.)
 */

import React, { useState } from "react"
import {
  Card,
  Select,
  Space,
  Typography,
  Row,
  Col,
  Grid,
} from "antd"
import { FilterOutlined } from "@ant-design/icons"
import type { DataProvider, BaseRecord, GetListResponse, GetListParams } from "@refinedev/core"

import AppShell from "../layout/AppShell"
import DocumentsTab from "../accounting/DocumentsTab"
import { NAVIGATION_RESOURCES, ALLOWED_MENU_KEYS } from "../../lib/navigation/resources"

const { Title } = Typography

// ============================================================================
// Stub Data Provider
// ============================================================================

const fileArchiveDataProvider: DataProvider = {
  getList: async <TData extends BaseRecord>(): Promise<GetListResponse<TData>> => {
    return { data: [], total: 0 }
  },
  getOne: async () => ({ data: {} as any }),
  create: async () => ({ data: {} as any }),
  update: async () => ({ data: {} as any }),
  deleteOne: async () => ({ data: {} as any }),
  getApiUrl: () => "",
}

// ============================================================================
// Subsidiaries
// ============================================================================

const SUBSIDIARIES = [
  { id: "erl", abbr: "ERL", name: "The Establishers" },
]

// ============================================================================
// Main Component
// ============================================================================

const FileArchiveInner: React.FC = () => {
  const screens = Grid.useBreakpoint()
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("erl")

  return (
    <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>File Archive</Title>
        </Col>
        <Col>
          <Space>
            <Select
              value={selectedSubsidiary}
              onChange={setSelectedSubsidiary}
              style={{ minWidth: 140 }}
              options={[
                { value: "all", label: "All Subsidiaries" },
                ...SUBSIDIARIES.map((s) => ({
                  value: s.id,
                  label: `${s.abbr} - ${s.name}`,
                })),
              ]}
              suffixIcon={<FilterOutlined />}
            />
          </Space>
        </Col>
      </Row>

      {/* Content */}
      <Card>
        <DocumentsTab subsidiaryId={selectedSubsidiary} />
      </Card>
    </div>
  )
}

// ============================================================================
// App Shell Wrapper
// ============================================================================

const FileArchiveApp: React.FC = () => {
  return (
    <AppShell
      dataProvider={fileArchiveDataProvider}
      resources={NAVIGATION_RESOURCES}
      allowedMenuKeys={ALLOWED_MENU_KEYS}
    >
      <FileArchiveInner />
    </AppShell>
  )
}

export default FileArchiveApp
