/**
 * Coaching Sessions App (Ant Design)
 *
 * Migrated from Material-UI to Ant Design.
 * Uses AppShell for layout and Ant Design components.
 */

import React, { useEffect, useState } from "react"
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
} from "firebase/firestore"
import { db } from "../../lib/firebase"
import { PATHS, logPath } from "../../lib/paths"
import { clearSessionSummaries } from "../../lib/sessionStats"
import { computeSessionStart } from "../../lib/sessions"
import { useBilling } from "../../lib/billing/useBilling"
import { readScanLogs, writeScanLog, type ScanLog } from "../../lib/scanLogs"
import { usePromptId } from "../../lib/promptId"
import AppShell from "../layout/AppShell"
import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Dropdown,
  Space,
  Spin,
  message,
  Drawer,
  Skeleton,
  Tag,
  Empty,
} from "antd"
import type { ItemType } from "antd/es/menu/interface"
import {
  SyncOutlined,
  ReloadOutlined,
  ClearOutlined,
  SettingOutlined,
} from "@ant-design/icons"

// Import existing dialog components (can be migrated to Ant Design later)
import OverviewTab from "../StudentDialog/OverviewTab"

const { Title, Text } = Typography

interface StudentMeta {
  abbr: string
  account: string
}

interface StudentDetails extends StudentMeta {
  sex?: string | null
  balanceDue?: number | null
  total?: number | null
  cancelled?: number | null
  proceeded?: number | null
  upcoming?: number | null
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "HKD",
    currencyDisplay: "code",
  }).format(n)

// Student card component using Ant Design
function StudentCard({
  student,
  onSelect,
}: {
  student: StudentDetails
  onSelect: (s: StudentDetails) => void
}) {
  const { data: bill, isLoading: billLoading } = useBilling(
    student.abbr,
    student.account
  )
  const due = bill?.balanceDue ?? student.balanceDue ?? null

  return (
    <Card
      hoverable
      onClick={() => onSelect(student)}
      style={{ marginBottom: 16 }}
      bodyStyle={{ padding: 16 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <Title level={5} style={{ marginBottom: 4, marginTop: 0 }}>
            {student.account}
          </Title>
          <Space size={8}>
            <Text type="secondary">
              {student.sex === undefined ? (
                <Skeleton.Input size="small" style={{ width: 20 }} active />
              ) : (
                student.sex ?? "—"
              )}
            </Text>
            <Text type="secondary">•</Text>
            <Text>
              Due:{" "}
              {billLoading ? (
                <Skeleton.Input size="small" style={{ width: 80 }} active />
              ) : (
                <Text strong type={due && due > 0 ? "danger" : "success"}>
                  {due == null ? "—" : formatCurrency(due)}
                </Text>
              )}
            </Text>
          </Space>
        </div>
        <div style={{ textAlign: "right" }}>
          <Text type="secondary">
            Sessions:{" "}
            {student.proceeded === undefined ? (
              <Skeleton.Input size="small" style={{ width: 30 }} active />
            ) : (
              <Text strong>{student.proceeded ?? student.total ?? "—"}</Text>
            )}
          </Text>
          {student.upcoming !== undefined && student.upcoming > 0 && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {student.upcoming} upcoming
            </Tag>
          )}
        </div>
      </div>
    </Card>
  )
}

// Data provider for Refine (stub - this page doesn't use Refine data features)
const dataProvider = {
  getList: async () => ({ data: [] as any[], total: 0 }),
  getOne: async () => ({ data: {} as any }),
  create: async () => ({ data: {} as any }),
  update: async () => ({ data: {} as any }),
  deleteOne: async () => ({ data: {} as any }),
  getApiUrl: () => "",
}

export default function CoachingSessionsApp() {
  const [students, setStudents] = useState<StudentDetails[]>([])
  const promptId = usePromptId()
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState("")
  const [selected, setSelected] = useState<StudentDetails | null>(null)
  const [serviceMode, setServiceMode] = useState(false)
  const [scanning, setScanning] = useState<"inc" | "full" | null>(null)
  const [lastScan, setLastScan] = useState<ScanLog | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Menu items for tools dropdown
  const menuItems: ItemType[] = [
    {
      key: "inc-scan",
      icon: <SyncOutlined spin={scanning === "inc"} />,
      label: "Incremental Scan",
      disabled: scanning !== null,
    },
    {
      key: "full-scan",
      icon: <ReloadOutlined spin={scanning === "full"} />,
      label: "Full Resync",
      disabled: scanning !== null,
    },
    { type: "divider" },
    {
      key: "clear-cache",
      icon: <ClearOutlined />,
      label: "Clear Session Cache",
      danger: true,
    },
  ]

  const handleMenuClick = async ({ key }: { key: string }) => {
    if (key === "inc-scan") {
      await handleScan(false)
    } else if (key === "full-scan") {
      await handleScan(true)
    } else if (key === "clear-cache") {
      await handleClearAll()
    }
  }

  const handleClearAll = async () => {
    try {
      await clearSessionSummaries()
      message.success("Session summaries cleared")
    } catch (err) {
      console.error(err)
      message.error("Failed to clear session summaries")
    }
  }

  const handleScan = async (full: boolean) => {
    setScanning(full ? "full" : "inc")
    try {
      const res = await fetch("/api/calendar-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          full ? { action: "scanAll", forceFull: true } : { action: "scanAll" }
        ),
      })
      const data = await res.json()
      const msg = res.ok
        ? data.message || (full ? "Full resync completed" : "Scan completed")
        : data.message || res.statusText

      if (res.ok) {
        message.success(msg)
      } else {
        message.error("Scan failed: " + msg)
      }

      const log: ScanLog = {
        at: Date.now(),
        mode: full ? "full" : "inc",
        ok: res.ok,
        message: msg,
      }
      writeScanLog(log)
      setLastScan(log)
    } catch (err: any) {
      const msg = err.message || String(err)
      message.error("Scan failed: " + msg)
      const log: ScanLog = {
        at: Date.now(),
        mode: full ? "full" : "inc",
        ok: false,
        message: msg,
      }
      writeScanLog(log)
      setLastScan(log)
    } finally {
      setScanning(null)
    }
  }

  const handleSelectStudent = (student: StudentDetails) => {
    setSelected(student)
    setDrawerOpen(true)
  }

  useEffect(() => {
    setLastScan(readScanLogs()[0] || null)
  }, [])

  useEffect(() => {
    let mounted = true
    const unsubs: (() => void)[] = []

    async function loadAll() {
      console.log("📥 loading students list")
      logPath("students", PATHS.students)
      const snap = await getDocs(collection(db, PATHS.students))
      console.log("   found " + snap.size + " students")
      const basics: StudentMeta[] = snap.docs.map((d) => ({
        abbr: d.id,
        account: (d.data() as any).account,
      }))

      if (!mounted) return
      setStudents(
        basics.map((b) => ({
          ...b,
          total: undefined,
          cancelled: undefined,
          proceeded: undefined,
          upcoming: undefined,
          sex: undefined,
          balanceDue: undefined,
        }))
      )
      setLoading(false)

      const totalCount = basics.length
      await Promise.all(
        basics.map(async (b, i) => {
          const latest = async (col: string) => {
            const path = PATHS.student(b.abbr) + "/" + col
            logPath("studentSub", path)
            const snap = await getDocs(
              query(
                collection(db, path),
                orderBy("timestamp", "desc"),
                limit(1)
              )
            )
            if (snap.empty) return undefined
            return (snap.docs[0].data() as any)[col]
          }

          const [firstName, lastName] = await Promise.all([
            latest("firstName"),
            latest("lastName"),
          ])
          if (!mounted) return
          setLoadingStatus(
            (firstName || b.account || b.abbr) +
              " " +
              (lastName || "") +
              " - (" +
              (i + 1) +
              " of " +
              totalCount +
              ")"
          )

          const [sex, sessSnap] = await Promise.all([
            latest("sex"),
            (async () => {
              logPath("sessionsQuery", PATHS.sessions)
              return getDocs(
                query(
                  collection(db, PATHS.sessions),
                  where("sessionName", "==", b.account)
                )
              )
            })(),
          ])

          const starts = await Promise.all(
            sessSnap.docs.map((sd) =>
              computeSessionStart(sd.id, sd.data() as any)
            )
          )
          const total = sessSnap.size
          const now = new Date()
          let upcoming = 0
          starts.forEach((d) => {
            if (d && d > now) upcoming++
          })

          if (!mounted) return
          setStudents((prev) =>
            prev.map((s) =>
              s.abbr === b.abbr ? { ...s, sex: sex ?? null, total, upcoming } : s
            )
          )

          // Listen to billing summary updates
          const unsub = onSnapshot(doc(db, PATHS.student(b.abbr)), (snap) => {
            const data = snap.data() as any
            const bs = data?.cached?.billingSummary || data?.billingSummary
            const bd = bs?.balanceDue
            const totalSessions = data?.totalSessions
            const cancelled = data?.cancelled
            const proceeded =
              data?.proceeded ??
              (totalSessions != null && cancelled != null
                ? totalSessions - cancelled
                : undefined)
            setStudents((prev) =>
              prev.map((s) =>
                s.abbr === b.abbr
                  ? {
                      ...s,
                      balanceDue: bd ?? null,
                      total: totalSessions ?? s.total,
                      cancelled: cancelled ?? s.cancelled,
                      proceeded: proceeded ?? s.proceeded,
                    }
                  : s
              )
            )
          })
          unsubs.push(unsub)
        })
      )

      setLoadingStatus("")
    }

    loadAll().catch(console.error)

    return () => {
      mounted = false
      unsubs.forEach((u) => u())
    }
  }, [])

  return (
    <AppShell
      dataProvider={dataProvider}
      resources={[
        {
          name: "dashboard",
          list: "/dashboard",
          meta: { label: "Dashboard" },
        },
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
      allowedMenuKeys={[
        "dashboard",
        "client-directory",
        "projects",
        "finance",
        "accounting",
        "coaching-sessions",
        "tools",
      ]}
    >
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Coaching Sessions
            </Title>
            {loadingStatus && (
              <Text type="secondary">Loading: {loadingStatus}</Text>
            )}
            {lastScan && (
              <Text type="secondary" style={{ marginLeft: 16 }}>
                Last scan: {new Date(lastScan.at).toLocaleString()} (
                {lastScan.mode})
              </Text>
            )}
          </div>
          <Space>
            <Dropdown
              menu={{ items: menuItems, onClick: handleMenuClick }}
              trigger={["click"]}
            >
              <Button icon={<SettingOutlined />}>Tools</Button>
            </Dropdown>
          </Space>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">Loading students...</Text>
            </div>
          </div>
        ) : students.length === 0 ? (
          <Empty description="No students found" />
        ) : (
          <Row gutter={[16, 16]}>
            {students.map((student) => (
              <Col key={student.abbr} xs={24} sm={12} md={8} lg={6}>
                <StudentCard student={student} onSelect={handleSelectStudent} />
              </Col>
            ))}
          </Row>
        )}

        {/* Student Detail Drawer */}
        <Drawer
          title={selected?.account || "Student Details"}
          placement="right"
          size="large"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
        >
          {selected && (
            <OverviewTab
              abbr={selected.abbr}
              account={selected.account}
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              serviceMode={serviceMode}
            />
          )}
        </Drawer>
      </div>
    </AppShell>
  )
}
