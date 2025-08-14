// pages/dashboard/businesses/coaching-sessions.tsx

import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore'
import { useSnackbar } from 'notistack'
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
  CircularProgress,
  Box,
  Menu,
  MenuItem,
  IconButton,
  TextField,
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
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
  const { enqueueSnackbar } = useSnackbar()
  const [renameOpen, setRenameOpen] = useState(false)
  const [detached, setDetached] = useState<any | null>(null)
  const [scanAccount, setScanAccount] = useState('')

  const openToolsMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    setToolsAnchor(e.currentTarget)
  }
  const closeToolsMenu = () => setToolsAnchor(null)
  const handleClearAll = async () => {
    closeToolsMenu()
    try {
      await clearSessionSummaries()
      enqueueSnackbar('Session summaries cleared', { variant: 'success' })
    } catch (err) {
      console.error(err)
      enqueueSnackbar('Failed to clear session summaries', { variant: 'error' })
    }
  }

  const handleScan = async (forceFull?: boolean) => {
    try {
      const res = await fetch('/api/calendar-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scanAll', forceFull: forceFull || false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      enqueueSnackbar('Processed: ' + (data.processed || 0), {
        variant: 'success',
      })
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Scan failed', { variant: 'error' })
    }
  }

  const handleScanOne = async () => {
    try {
      const res = await fetch('/api/calendar-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scanOne',
          account: scanAccount,
          daysBack: 365,
          daysForward: 90,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      enqueueSnackbar('Processed: ' + (data.processed || 0), {
        variant: 'success',
      })
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Scan failed', { variant: 'error' })
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
      setStudents(basics.map((b) => ({ ...b, total: 0, upcoming: 0 })))
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

          const [sexRaw, sessSnap] = await Promise.all([
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
          const sex = sexRaw === undefined || sexRaw === null ? null : sexRaw

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
                ? { ...s, sex, total, upcoming }
                : s,
            ),
          )

          // Listen to billing summary updates on the student document
          const unsub = onSnapshot(doc(db, PATHS.student(b.abbr)), (snap) => {
            const bdRaw = (snap.data() as any)?.billingSummary?.balanceDue
            const bd = bdRaw === undefined || bdRaw === null ? null : bdRaw
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
            <Grid item key={s.abbr} xs={12} sm={6} md={4}>
              <Card>
                <CardActionArea onClick={() => setSelected(s)}>
                  <CardContent>
                    <Typography variant="h6">{s.account}</Typography>
                    <Typography>
                      {s.sex === undefined ? (
                        <CircularProgress size={14} className="slow-blink" />
                      ) : s.sex || '–'}
                      {' '}• Due:{' '}
                      {s.balanceDue === undefined ? (
                        <CircularProgress size={14} className="slow-blink" />
                      ) : s.balanceDue === null ? '–' : formatCurrency(Number(s.balanceDue))}
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
          <MenuItem
            onClick={() => {
              closeToolsMenu()
              handleScan(true)
            }}
          >
            ♻️ Force Full Rescan
          </MenuItem>
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
        <Box
          sx={{
            position: 'sticky',
            left: 0,
            bottom: 16,
            display: 'flex',
            gap: 1,
            mt: 2,
            flexWrap: 'wrap',
          }}
        >
          <TextField
            size="small"
            placeholder="Account"
            value={scanAccount}
            onChange={(e) => setScanAccount(e.target.value)}
            sx={{ bgcolor: 'background.paper' }}
          />
          <Button
            variant="contained"
            disabled={!scanAccount}
            onClick={handleScanOne}
            sx={{ bgcolor: 'background.paper', color: 'text.primary' }}
          >
            Scan this account
          </Button>
          <Button
            variant="contained"
            onClick={() => handleScan(false)}
            sx={{ bgcolor: 'background.paper', color: 'text.primary' }}
          >
            Tools
          </Button>
          <IconButton onClick={openToolsMenu} sx={{ bgcolor: 'background.paper' }}>
            <MoreVertIcon />
          </IconButton>
        </Box>
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

      <BatchRenamePayments
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
      />
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
