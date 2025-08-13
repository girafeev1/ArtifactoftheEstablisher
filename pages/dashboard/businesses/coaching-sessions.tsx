// pages/dashboard/businesses/coaching-sessions.tsx

import React, { useEffect, useState } from 'react'
import { collection, getDocs, onSnapshot, doc } from 'firebase/firestore'
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
import { keyframes } from '@mui/system'
import { PATHS, logPath } from '../../../lib/paths'
import OverviewTab from '../../../components/StudentDialog/OverviewTab'
import SessionDetail from '../../../components/StudentDialog/SessionDetail'
import FloatingWindow from '../../../components/StudentDialog/FloatingWindow'
import { clearSessionSummaries } from '../../../lib/sessionStats'
import BatchRenamePayments from '../../../tools/BatchRenamePayments'
import { useBilling } from '../../../lib/billing/useBilling'
import { scanGoogleCalendar } from '../../../lib/gcal'

interface StudentMeta {
  abbr: string
  account: string
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

const blinkFade = keyframes`
  0% {opacity:.4}
  50% {opacity:1}
  100% {opacity:.4}
`

const blinkSx = {
  animation: `${blinkFade} 1.2s ease-in-out infinite`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    opacity: 0.4,
  },
}

function StudentCard({
  abbr,
  account,
  onClick,
}: {
  abbr: string
  account: string
  onClick: () => void
}) {
  const { data: bill } = useBilling(abbr, account)
  const [sex, setSex] = useState<string | undefined>()
  const [balanceDue, setBalanceDue] = useState<number | undefined>()

  useEffect(() => {
    const unsub = onSnapshot(doc(db, PATHS.student(abbr)), (snap) => {
      const data = snap.data() as any
      setSex(data?.sex)
      setBalanceDue(data?.billingSummary?.balanceDue)
    })
    return () => unsub()
  }, [abbr])

  const rows = bill?.rows || []
  const totalNonCancelled = rows.filter((r) => !r.flags.cancelled).length
  const upcoming = rows.filter(
    (r) => !r.flags.cancelled && r.startMs > Date.now(),
  ).length

  return (
    <Card>
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Typography variant="h6">{account}</Typography>
          <Typography>
            <Box component="span" sx={sex === undefined ? blinkSx : undefined}>
              {sex ?? '–'}
            </Box>{' '}
            • Due:{' '}
            <Box
              component="span"
              sx={balanceDue === undefined ? blinkSx : undefined}
            >
              {balanceDue !== undefined ? formatCurrency(balanceDue) : '–'}
            </Box>
          </Typography>
          <Typography sx={!bill ? blinkSx : undefined}>
            Total: {bill ? totalNonCancelled : '–'}
            {bill && upcoming > 0 ? ` → ${upcoming}` : ''}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export default function CoachingSessions() {
  const [students, setStudents] = useState<StudentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StudentMeta | null>(null)
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
      logPath('students', PATHS.students)
      const snap = await getDocs(collection(db, PATHS.students))
      const basics: StudentMeta[] = snap.docs.map((d) => ({
        abbr: d.id,
        account: (d.data() as any).account,
      }))
      if (!mounted) return
      setStudents(basics)
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
          <LinearProgress />
        </Box>
      )}

      <Box sx={{ position: 'relative', pb: 8 }}>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {students.map((s) => (
            <Grid item key={s.abbr} xs={12} sm={6} md={4}>
              <StudentCard
                abbr={s.abbr}
                account={s.account}
                onClick={() => setSelected(s)}
              />
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
            onClick={async () => {
              closeToolsMenu()
              try {
                const res = await scanGoogleCalendar()
                setScanMessage(
                  `Added ${res.added || 0}, updated ${res.updated || 0}, skipped ${res.skipped || 0}`,
                )
              } catch (e) {
                setScanMessage('Google Calendar scan failed')
              }
            }}
          >
            📅 Scan Google Calendar
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
            detached.startMs,
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

