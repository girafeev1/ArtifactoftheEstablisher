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
} from '@mui/material'
import { PATHS, logPath } from '../../../lib/paths'
import OverviewTab from '../../../components/StudentDialog/OverviewTab'
import SessionDetail from '../../../components/StudentDialog/SessionDetail'
import FloatingWindow from '../../../components/StudentDialog/FloatingWindow'
import { clearSessionSummaries } from '../../../lib/sessionStats'
import BatchRenamePayments from '../../../tools/BatchRenamePayments'
import { computeSessionStart } from '../../../lib/sessions'
import { computeBalanceDue } from '../../../lib/billing/balance'

interface StudentMeta {
  abbr: string
  account: string
}
interface StudentDetails extends StudentMeta {
  sex?: string
  balanceDue?: number
  total: number
  upcoming: number
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

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
      setStudents(basics.map((b) => ({ ...b, total: 0, upcoming: 0 })))

      const unsubs: (() => void)[] = []
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

          const [sex, balanceDue, sessSnap] = await Promise.all([
            latest('sex'),
            computeBalanceDue(b.abbr, b.account),
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
                ? { ...s, sex, balanceDue, total, upcoming }
                : s,
            ),
          )

          // Listen to billing summary updates on the student document
          const unsub = onSnapshot(doc(db, PATHS.student(b.abbr)), (snap) => {
            const bd = (snap.data() as any)?.billingSummary?.balanceDue
            setStudents((prev) =>
              prev.map((s) =>
                s.abbr === b.abbr ? { ...s, balanceDue: bd } : s,
              ),
            )
          })
          unsubs.push(unsub)
        })
      )

      if (!mounted) return
      setLoading(false)
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

      {!loading && (
        <Box sx={{ position: 'relative', pb: 8 }}>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {students.map((s) => (
              <Grid item key={s.abbr} xs={12} sm={6} md={4}>
                <Card>
                  <CardActionArea onClick={() => setSelected(s)}>
                    <CardContent>
                      <Typography variant="h6">{s.account}</Typography>
                      <Typography>
                        {s.sex ?? '–'} • Due: {formatCurrency(s.balanceDue ?? 0)}
                      </Typography>
                      <Typography>
                        Total: {s.total}
                        {s.upcoming > 0 ? ` → ${s.upcoming}` : ''}
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
        </Box>
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
      <Button
        variant="contained"
        sx={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
        onClick={openToolsMenu}
      >
        Tools
      </Button>
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
