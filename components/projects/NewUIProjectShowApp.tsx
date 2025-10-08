import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Row,
  Steps,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from "antd"
import {
  ArrowLeftOutlined,
  EditOutlined,
} from "@ant-design/icons"

import type { ProjectRecord } from "../../lib/projectsDatabase"
import AppShell from "../new-ui/AppShell"
import {
  amountText,
  normalizeProject,
  paidDateText,
  paymentChipColor,
  paymentChipLabel,
  stringOrNA,
  type NormalizedProject,
} from "./projectUtils"
import { projectsDataProvider } from "./NewUIProjectsApp"

const { Title, Text } = Typography

type ProjectShowResponse = {
  data?: ProjectRecord
}

const headingStyle = { fontFamily: "'Cantata One'", fontWeight: 400 }
const sectionSubtitleStyle = { fontFamily: "'Newsreader'", fontWeight: 300, color: "#475569" }
const labelStyle = { fontFamily: "'Newsreader'", fontWeight: 200, color: "#475569" }
const valueStyle = { fontFamily: "'Newsreader'", fontWeight: 500, color: "#0f172a" }
const descriptorTextStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 400,
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.2,
}
const descriptorItalicTextStyle = { ...descriptorTextStyle, fontStyle: "italic" }
const subsidiaryChipStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 500,
  borderRadius: 999,
  backgroundColor: "#e0f2fe",
  color: "#0c4a6e",
  border: "none",
  padding: "2px 14px",
  fontSize: 12,
  marginTop: 8,
  width: "fit-content" as const,
}
const statusStepTitleStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 500,
  color: "#0f172a",
  fontSize: 14,
}
const paymentPalette = {
  green: { backgroundColor: "#dcfce7", color: "#166534" },
  red: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  default: { backgroundColor: "#e2e8f0", color: "#1f2937" },
} as const

const ProjectsShowContent = () => {
  const router = useRouter()
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<NormalizedProject | null>(null)

  const projectId = useMemo(() => {
    const raw = router.query.projectId
    if (Array.isArray(raw)) {
      return raw[0]
    }
    return raw
  }, [router.query.projectId])

  const handleBack = useCallback(() => {
    router.push("/dashboard/new-ui/projects")
  }, [router])

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return
    }

    const controller = new AbortController()
    const loadProject = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/projects/by-id/${encodeURIComponent(projectId)}`, {
          credentials: "include",
          signal: controller.signal,
        })

        const payload = (await response.json().catch(() => ({}))) as ProjectShowResponse & {
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load project")
        }

        if (!payload.data) {
          throw new Error("Project not found")
        }

        setProject(normalizeProject(payload.data))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        const description =
          error instanceof Error ? error.message : "Unable to retrieve project details"
        message.error(description)
        setProject(null)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadProject()

    return () => {
      controller.abort()
    }
  }, [message, projectId, router.isReady])

  const paidChipKey = paymentChipColor(project?.paid ?? null)
  const paidChipPalette = paymentPalette[paidChipKey] ?? paymentPalette.default
  const paidOnText = paidDateText(project?.paid ?? null, project?.onDateDisplay ?? null)

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 16px",
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (!project) {
    return (
      <div
        style={{
          padding: "48px 16px",
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Space direction="vertical" align="center" size={24}>
          <Empty description="Project unavailable" />
          <Button type="primary" onClick={handleBack} icon={<ArrowLeftOutlined />}>
            Back to Projects
          </Button>
        </Space>
      </div>
    )
  }

  const timelineItems = [
    {
      color: "blue",
      children: (
        <div>
          <Text style={valueStyle}>Project pickup date</Text>
          <div style={{ ...labelStyle, marginTop: 4 }}>{project.projectDateDisplay ?? "-"}</div>
        </div>
      ),
    },
    {
      color: "green",
      children: (
        <div>
          <Text style={valueStyle}>Payment status</Text>
          <div style={{ ...labelStyle, marginTop: 4 }}>{paymentChipLabel(project.paid)}</div>
        </div>
      ),
    },
    {
      color: "gray",
      children: (
        <div>
          <Text style={valueStyle}>Subsidiary</Text>
          <div style={{ ...labelStyle, marginTop: 4 }}>{stringOrNA(project.subsidiary)}</div>
        </div>
      ),
    },
  ]

  const normalizedInvoice = project.invoice?.trim() ?? ""
  let progressIndex = 0
  if (normalizedInvoice.length > 0) {
    progressIndex = 1
  }
  if (project.paid) {
    progressIndex = 3
  }

  const statusItems = [
    { title: <span style={statusStepTitleStyle}>Project Saved</span> },
    { title: <span style={statusStepTitleStyle}>Invoice Drafted</span> },
    { title: <span style={statusStepTitleStyle}>Invoice Sent</span> },
    { title: <span style={statusStepTitleStyle}>Payment Received</span> },
  ]

  return (
    <div
      style={{
        padding: "32px 24px",
        minHeight: "100%",
        background: "#f8fafc",
      }}
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{ paddingLeft: 0, fontFamily: "'Newsreader'", fontWeight: 500 }}
          >
            Back to Projects
          </Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 320px" }}>
              <span style={descriptorTextStyle}>
                Project No. {stringOrNA(project.projectNumber)}
              </span>
              <span style={descriptorItalicTextStyle}>{stringOrNA(project.projectNature)}</span>
              <Title level={2} style={{ ...headingStyle, margin: 0 }}>
                {stringOrNA(project.projectTitle)}
              </Title>
              {project.subsidiary ? (
                <Tag style={subsidiaryChipStyle}>{stringOrNA(project.subsidiary)}</Tag>
              ) : null}
            </div>
            <Button
              type="default"
              icon={<EditOutlined />}
              style={{
                fontFamily: "'Newsreader'",
                fontWeight: 500,
                background: "#fff",
                borderColor: "#cbd5f5",
              }}
            >
              Edit
            </Button>
          </div>
          <Steps current={progressIndex} responsive items={statusItems} />
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={16}>
            <Card
              title={<span style={headingStyle}>Project Details</span>}
              bordered={false}
              style={{ borderRadius: 18 }}
            >
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <Descriptions column={1} colon={false} labelStyle={labelStyle} contentStyle={valueStyle}>
                  <Descriptions.Item label="Project No.">
                    {stringOrNA(project.projectNumber)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Project">
                    {stringOrNA(project.presenterWorkType)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Project Title">
                    {stringOrNA(project.projectTitle)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Work Type">
                    {stringOrNA(project.projectNature)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Project Pickup Date">
                    {project.projectDateDisplay ?? "-"}
                  </Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: 0 }} />
                <div>
                  <Title level={4} style={{ ...headingStyle, marginTop: 0, marginBottom: 16 }}>
                    Payment Overview
                  </Title>
                  <Row gutter={[24, 16]}>
                    <Col xs={24} md={8}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={labelStyle}>Amount</span>
                        <span style={{ ...valueStyle, fontSize: 18 }}>{amountText(project.amount)}</span>
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={labelStyle}>Payment Status</span>
                        <Tag
                          color={paidChipPalette.backgroundColor}
                          style={{
                            ...valueStyle,
                            color: paidChipPalette.color,
                            borderRadius: 999,
                            border: "none",
                            padding: "2px 16px",
                            fontSize: 13,
                          }}
                        >
                          {paymentChipLabel(project.paid)}
                        </Tag>
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={labelStyle}>Paid On</span>
                        <span style={valueStyle}>{paidOnText}</span>
                      </div>
                    </Col>
                  </Row>
                </div>
                <Divider style={{ margin: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Title level={4} style={{ ...headingStyle, marginTop: 0, marginBottom: 0 }}>
                    Invoice
                  </Title>
                  <Text style={valueStyle}>{stringOrNA(project.invoice)}</Text>
                </div>
              </Space>
            </Card>

            <Card
              title={<span style={headingStyle}>Notes</span>}
              bordered={false}
              style={{ borderRadius: 18, marginTop: 24 }}
            >
              <Text style={sectionSubtitleStyle}>
                Add engagement summaries, follow-up reminders, and client feedback. This area mirrors the Refine
                CRM sample layout so we can iterate on the exact fields later.
              </Text>
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            <Card
              title={<span style={headingStyle}>Client Company</span>}
              bordered={false}
              style={{ borderRadius: 18 }}
            >
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={labelStyle}>Company</span>
                  <span style={valueStyle}>{stringOrNA(project.clientCompany)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={labelStyle}>Primary Contact</span>
                  <span style={valueStyle}>N/A</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={labelStyle}>Email</span>
                  <span style={valueStyle}>N/A</span>
                </div>
              </Space>
            </Card>

            <Card
              title={<span style={headingStyle}>Project Timeline</span>}
              bordered={false}
              style={{ borderRadius: 18, marginTop: 24 }}
            >
              <Timeline items={timelineItems} />
            </Card>

            <Card
              title={<span style={headingStyle}>Attachments</span>}
              bordered={false}
              style={{ borderRadius: 18, marginTop: 24 }}
            >
              <Text style={sectionSubtitleStyle}>No files uploaded yet.</Text>
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  )
}

const ProjectsShowApp = () => (
  <AppShell
    dataProvider={projectsDataProvider}
    resources={[
      { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
      {
        name: "client-directory",
        list: "/dashboard/new-ui/client-accounts",
        meta: { label: "Client Accounts" },
      },
      {
        name: "projects",
        list: "/dashboard/new-ui/projects",
        meta: { label: "Projects" },
      },
    ]}
    allowedMenuKeys={["dashboard", "client-directory", "projects"]}
  >
    <ProjectsShowContent />
  </AppShell>
)

export default ProjectsShowApp
