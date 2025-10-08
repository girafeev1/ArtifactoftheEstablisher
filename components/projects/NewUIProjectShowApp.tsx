import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/router"
import {
  App as AntdApp,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Row,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from "antd"
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
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

  const breadcrumbItems: Array<{ title: ReactNode; href?: string }> = [
    {
      title: <span style={{ fontFamily: "'Newsreader'", fontWeight: 400 }}>Dashboard</span>,
      href: "/dashboard",
    },
    {
      title: <span style={{ fontFamily: "'Newsreader'", fontWeight: 400 }}>Projects</span>,
      href: "/dashboard/new-ui/projects",
    },
    {
      title: (
        <span style={{ fontFamily: "'Newsreader'", fontWeight: 500 }}>
          {stringOrNA(project.projectNumber)}
        </span>
      ),
    },
  ]

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
          <Breadcrumb separator=">" style={{ marginTop: 8 }} items={breadcrumbItems} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Title level={2} style={{ ...headingStyle, margin: 0 }}>
            {stringOrNA(project.projectTitle)}
          </Title>
          <Text style={sectionSubtitleStyle}>
            Project No. {stringOrNA(project.projectNumber)} · Client {stringOrNA(project.clientCompany)}
          </Text>
          <Space size={12} wrap>
            <Button type="primary" icon={<EditOutlined />}>
              Edit Project
            </Button>
            <Button icon={<DownloadOutlined />}>Download Brief</Button>
            <Button icon={<FilePdfOutlined />}>Export PDF</Button>
          </Space>
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={16}>
            <Card
              title={<span style={headingStyle}>Project Details</span>}
              bordered={false}
              style={{ borderRadius: 18 }}
            >
              <Descriptions column={2} colon={false} labelStyle={labelStyle} contentStyle={valueStyle}>
                <Descriptions.Item label="Project Number">
                  {stringOrNA(project.projectNumber)}
                </Descriptions.Item>
                <Descriptions.Item label="Project Nature">
                  {stringOrNA(project.projectNature)}
                </Descriptions.Item>
                <Descriptions.Item label="Presenter Work Type">
                  {stringOrNA(project.presenterWorkType)}
                </Descriptions.Item>
                <Descriptions.Item label="Project pickup date">
                  {project.projectDateDisplay ?? "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Invoice">
                  {stringOrNA(project.invoice)}
                </Descriptions.Item>
                <Descriptions.Item label="Subsidiary">
                  {stringOrNA(project.subsidiary)}
                </Descriptions.Item>
                <Descriptions.Item label="Year">{stringOrNA(project.year)}</Descriptions.Item>
                <Descriptions.Item label="Paid To">{stringOrNA(project.paidTo)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              title={<span style={headingStyle}>Payment Overview</span>}
              bordered={false}
              style={{ borderRadius: 18, marginTop: 24 }}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Space size={24} wrap>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={labelStyle}>Amount</span>
                    <span style={{ ...valueStyle, fontSize: 18 }}>{amountText(project.amount)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={labelStyle}>Paid On</span>
                    <span style={valueStyle}>{paidOnText}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                </Space>
                <Divider style={{ margin: "12px 0" }} />
                <Text style={sectionSubtitleStyle}>
                  Track receivables and reconcile cleared invoices directly from this workspace.
                </Text>
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
