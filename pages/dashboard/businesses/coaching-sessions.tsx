// pages/dashboard/businesses/coaching-sessions.tsx

import React, { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
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
  Switch,
  FormControlLabel,
} from '@mui/material'
import { PATHS, logPath } from '../../../lib/paths'
import OverviewTab from '../../../components/StudentDialog/OverviewTab'
import SessionDetail from '../../../components/StudentDialog/SessionDetail'
import FloatingWindow from '../../../components/StudentDialog/FloatingWindow'
import { clearSessionSummaries } from '../../../lib/sessionStats'
import BatchRenamePayments from '../../../tools/BatchRenamePayments'
import { computeSessionStart } from '../../../lib/sessions'

interface StudentMeta {
  abbr: string
  account: string
}
interface StudentDetails extends StudentMeta {
  sex?: string
  balanceDue?: number
  total: number
  upcoming: number
  dueOn?: string
}

type Retainer = { retainerStarts: any; retainerEnds: any }
type Session = { id: string; startMs: number; payments?: { paymentMade: any }[] }

const fmtMMMDDYYYY = (d: Date) =>
  d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

const isCoveredByRetainer = (ms: number, retainers: Retainer[]) => {
  return retainers.some((r) => {
    const s = r.retainerStarts?.toDate?.() ?? new Date(r.retainerStarts)
    const e = r.retainerEnds?.toDate?.() ?? new Date(r.retainerEnds)
    return ms >= s.getTime() && ms <= e.getTime()
  })
}

const computeDueOn = (sessions: Session[], retainers: Retainer[]) => {
  const next = [...sessions]
    .sort((a, b) => a.startMs - b.startMs)
    .find((s) => {
      const hasPayment = (s.payments?.length ?? 0) > 0
      const covered = isCoveredByRetainer(s.startMs, retainers)
      return !hasPayment && !covered
    })
  return next ? fmtMMMDDYYYY(new Date(next.startMs)) : '-'
}

export default function CoachingSessions() {
  const [students, setStudents] = useState<StudentDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [selected, setSelected] = useState<StudentDetails | null>(null)
  const [serviceMode, setServiceMode] = useState(false)
  const [toolsAnchor, setToolsAnchor] = useState<null | HTMLElement>(null)
  const [scanMessage, setScanMessage] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [detached, setDetached] = useState<any | null>(null)

  const openToolsMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
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

  useEffect(() => {
    let mounted = true

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
      setStudents(basics.map((b) => ({ ...b, total: 0, upcoming: 0, dueOn: '-' })))

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

          const [sex, balRaw] = await Promise.all([
            latest('sex'),
            latest('balanceDue'),
          ])
          const balanceDue = parseFloat(balRaw as any) || 0

          logPath('sessionsQuery', PATHS.sessions)
          const sessSnap = await getDocs(
            query(collection(db, PATHS.sessions), where('sessionName', '==', b.account))
          )
          const total = sessSnap.size
          let upcoming = 0
          const now = new Date()
          const sessionList: Session[] = await Promise.all(
            sessSnap.docs.map(async (sd) => {
              const data = sd.data() as any
              const start = await computeSessionStart(sd.id, data)
              const startMs = start?.getTime() ?? 0
              if (start && start > now) upcoming++
              const payPath = PATHS.sessionPayment(sd.id)
              logPath('sessionPayment', payPath)
              const paySnap = await getDocs(collection(db, payPath))
              const payments = paySnap.docs.map((p) => p.data() as any)
              return { id: sd.id, startMs, payments }
            })
          )
          const retPath = PATHS.retainers(b.abbr)
          logPath('retainers', retPath)
          const retSnap = await getDocs(collection(db, retPath))
          const retainers = retSnap.docs.map((d) => d.data() as any)
          const dueOn = computeDueOn(sessionList, retainers)

          if (!mounted) return
          setStudents((prev) =>
            prev.map((s) =>
              s.abbr === b.abbr
                ? { ...s, sex, balanceDue, total, upcoming, dueOn }
                : s
            )
          )
        })
      )

      if (!mounted) return
      setLoading(false)
    }

    loadAll().catch(console.error)
    return () => {
      mounted = false
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

      {!loading && (
        <>
          <Box
            sx={{
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={serviceMode}
                  onChange={(_, checked) => setServiceMode(checked)}
                />
              }
              label="Service Mode"
            />
            <Button variant="outlined" onClick={openToolsMenu}>
              Tools
            </Button>
          </Box>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {students.map((s) => (
              <Grid item key={s.abbr} xs={12} sm={6} md={4}>
                <Card>
                  <CardActionArea onClick={() => setSelected(s)}>
                    <CardContent>
                      <Typography variant="h6">{s.account}</Typography>
                      <Typography>
                        {s.sex ?? '–'} • Due: ${(s.balanceDue ?? 0).toFixed(2)}
                      </Typography>
                      <Typography>
                        Total: {s.total}
                        {s.upcoming > 0 ? ` → ${s.upcoming}` : ''}
                      </Typography>
                      <Typography variant="body2">
                        Due on: {s.dueOn || '-'}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Menu
            anchorEl={toolsAnchor}
            open={Boolean(toolsAnchor)}
            onClose={closeToolsMenu}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <MenuItem onClick={handleClearAll}>
              🗑️ Clear All Session Summaries
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeToolsMenu()
                setRenameOpen(true)
              }}
            >
              🏷️ Batch Rename Payments
            </MenuItem>
          </Menu>
        </>
      )}

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
          <SessionDetail session={detached} onBack={() => setDetached(null)} />
        </FloatingWindow>
      )}

      <Snackbar
        open={Boolean(scanMessage)}
        onClose={() => setScanMessage('')}
        message={scanMessage}
        autoHideDuration={4000}
      />
      <BatchRenamePayments
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
      />
    </SidebarLayout>
  )
}
