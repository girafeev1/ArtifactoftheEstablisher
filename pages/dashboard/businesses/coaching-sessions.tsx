// pages/dashboard/businesses/coaching-sessions.tsx

import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore'
import SidebarLayout from '../../../components/SidebarLayout'
import { db } from '../../../lib/firebase'
import {
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Button,
  LinearProgress,
  Box,
  Menu,
  MenuItem,
  Snackbar,
  CircularProgress,
} from '@mui/material'
import { PATHS, logPath } from '../../../lib/paths'
import OverviewTab from '../../../components/StudentDialog/OverviewTab'
import SessionDetail from '../../../components/StudentDialog/SessionDetail'
import FloatingWindow from '../../../components/StudentDialog/FloatingWindow'
import { clearSessionSummaries } from '../../../lib/sessionStats'
import { computeSessionStart } from '../../../lib/sessions'
import IconButton from '@mui/material/IconButton'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useBilling } from '../../../lib/billing/useBilling'
import LoadingDash from '../../../components/LoadingDash'

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
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

function StudentCard({
  student,
  onSelect,
}: {
  student: StudentDetails
  onSelect: (s: StudentDetails) => void
}) {
  const { data: bill, isLoading: billLoading } = useBilling(
    student.abbr,
    student.account,
  )
  const due = bill?.balanceDue ?? student.balanceDue ?? null
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  useEffect(() => {
    if (bill) setLastUpdated(Date.now())
  }, [bill])
  return (
    <Grid item xs={12} sm={6} md={4} lg={3}>
      <Card>
        <CardActionArea onClick={() => onSelect(student)}>
          <CardContent>
            <Typography variant="h6">{student.account}</Typography>
            <Typography>
              <span className={student.sex === undefined ? 'slow-blink' : undefined}>
                {student.sex ?? '—'}
              </span>{' '}
              • Due:{' '}
              {billLoading ? (
                <LoadingDash />
              ) : (
                <span>{due == null ? '—' : formatCurrency(due)}</span>
              )}
            </Typography>
            <Typography>
              Total:{' '}
              <span
                className={
                  student.proceeded === undefined ? 'slow-blink' : undefined
                }
              >
                {student.proceeded ?? student.total ?? '—'}
              </span>
              {student.upcoming === undefined ? (
                <span className="slow-blink"> → —</span>
              ) : student.upcoming > 0 ? (
                ` → ${student.upcoming}`
              ) : (
                ''
              )}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Grid>
  )
}

export default function CoachingSessions() {
  const [students, setStudents] = useState<StudentDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [selected, setSelected] = useState<StudentDetails | null>(null)
  const [serviceMode, setServiceMode] = useState(false)
  const [toolsAnchor, setToolsAnchor] = useState<null | HTMLElement>(null)
  const [scanMessage, setScanMessage] = useState('')
  const [scanning, setScanning] = useState<'inc' | 'full' | null>(null)
  const [detached, setDetached] = useState<any | null>(null)
  const openToolsMenu = (e: React.MouseEvent<HTMLElement>) => {
    setToolsAnchor(e.currentTarget)
  }
  const closeToolsMenu = () => setToolsAnchor(null)
  const handleClearAll = async () => {
    closeToolsMenu()
    try {
      await clearSessionSummaries()
      setScanMessage('Session summaries cleared')
    } catch (err) {
      console.error(err)
      setScanMessage('Failed to clear session summaries')
    }
  }

  const handleScan = async (full: boolean) => {
    closeToolsMenu()
    setScanning(full ? 'full' : 'inc')
    try {
      const res = await fetch('/api/calendar-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          full ? { action: 'scanAll', forceFull: true } : { action: 'scanAll' },
        ),
      })
      const data = await res.json()
      console.info('calendar scan', data)
      setScanMessage(
        res.ok ? data.message : `Scan failed: ${data.message || res.statusText}`,
      )
    } catch (err: any) {
      console.error(err)
      setScanMessage(`Scan failed: ${err.message || err}`)
    } finally {
      setScanning(null)
    }
  }

  useEffect(() => {
    let mounted = true
    const unsubs: (() => void)[] = []

    async function loadAll() {
      console.log('📥 loading students list')
      logPath('students', PATHS.students)
      const snap = await getDocs(collection(db, PATHS.students))
      console.log(`   found ${snap.size} students`)
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
        })),
      )
      setLoading(false)

      const totalCount = basics.length
      await Promise.all(
        basics.map(async (b, i) => {
          const latest = async (col: string) => {
            const path = `${PATHS.student(b.abbr)}/${col}`
            logPath('studentSub', path)
            const snap = await getDocs(
              query(
                collection(db, path),
                orderBy('timestamp', 'desc'),
                limit(1)
              )
            )
            if (snap.empty) {
              return undefined
            }
            return (snap.docs[0].data() as any)[col]
          }

          const [firstName, lastName] = await Promise.all([
            latest('firstName'),
            latest('lastName'),
          ])
          if (!mounted) return
          setLoadingStatus(
            `${firstName || b.account || b.abbr} ${lastName || ''} - (${i + 1} of ${totalCount})`
          )

          const [sex, sessSnap] = await Promise.all([
            latest('sex'),
            (async () => {
              logPath('sessionsQuery', PATHS.sessions)
              return getDocs(
                query(
                  collection(db, PATHS.sessions),
                  where('sessionName', '==', b.account),
                ),
              )
            })(),
          ])

          const starts = await Promise.all(
            sessSnap.docs.map((sd) => computeSessionStart(sd.id, sd.data() as any)),
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
              s.abbr === b.abbr
                ? { ...s, sex: sex ?? null, total, upcoming }
                : s,
            ),
          )

          // Listen to billing summary updates on the student document
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
                  : s,
              ),
            )
          })
          unsubs.push(unsub)
        })
      )

      if (!mounted) return
    }

    loadAll().catch(console.error)
    return () => {
      mounted = false
      unsubs.forEach((u) => u())
    }
  }, [])

  return (
    <SidebarLayout>
      {loading && (
        <Box sx={{ width: '100%' }}>
          <Typography align="center" sx={{ mb: 1 }}>
            {loadingStatus}
          </Typography>
          <LinearProgress />
          <Typography align="center" sx={{ mt: 1 }}>
            Loading student cards…
          </Typography>
        </Box>
      )}

      <Box sx={{ position: 'relative', pb: 8 }}>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {students.map((s) => (
            <StudentCard key={s.abbr} student={s} onSelect={setSelected} />
          ))}
        </Grid>
        <Menu
          anchorEl={toolsAnchor}
          open={Boolean(toolsAnchor)}
          onClose={closeToolsMenu}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          disablePortal={false}
        >
          <MenuItem
            disabled={scanning !== null}
            onClick={() => handleScan(false)}
          >
            {scanning === 'inc' && (
              <CircularProgress size={14} sx={{ mr: 1 }} />
            )}
            🔄 Incremental Scan
          </MenuItem>
          <MenuItem
            disabled={scanning !== null}
            onClick={() => handleScan(true)}
          >
            {scanning === 'full' && (
              <CircularProgress size={14} sx={{ mr: 1 }} />
            )}
            ♻️ Full Rescan
          </MenuItem>
          <MenuItem onClick={handleClearAll}>
            🗑️ Clear All Session Summaries
          </MenuItem>
        </Menu>
      </Box>

      {selected && (
        <OverviewTab
          abbr={selected.abbr}
          account={selected.account}
          open
          onClose={() => setSelected(null)}
          serviceMode={serviceMode}
          onPopDetail={(s) => setDetached(s)}
        />
      )}

      {detached && (
        <FloatingWindow
          title={`${detached.account} - #${detached.number} | ${new Date(
            detached.startMs
          ).toLocaleDateString(undefined, {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })} ${detached.time}`}
          onClose={() => setDetached(null)}
        >
          <SessionDetail
            abbr={detached.abbr}
            account={detached.account}
            session={detached}
            onBack={() => setDetached(null)}
          />
        </FloatingWindow>
      )}

      <Snackbar
        open={Boolean(scanMessage)}
        onClose={() => setScanMessage('')}
        message={scanMessage}
        autoHideDuration={4000}
      />
      <IconButton
        aria-label="Tools"
        onClick={openToolsMenu}
        sx={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          bgcolor: 'background.paper',
          color: 'text.primary',
          zIndex: 1300,
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <Button
        variant="contained"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          bgcolor: serviceMode ? 'red' : 'primary.main',
          animation: serviceMode ? 'blink 1s infinite' : 'none',
        }}
        onClick={() => setServiceMode((m) => !m)}
      >
        Service Mode
      </Button>
    </SidebarLayout>
  )
}
