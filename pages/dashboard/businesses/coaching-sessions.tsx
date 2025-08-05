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
} from '@mui/material'
import OverviewTab from '../../../components/StudentDialog/OverviewTab'
import SessionDetail from '../../../components/StudentDialog/SessionDetail'
import FloatingWindow from '../../../components/StudentDialog/FloatingWindow'
import { clearSessionSummaries } from '../../../lib/sessionStats'
import BatchRenamePayments from '../../../tools/BatchRenamePayments'

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
      const snap = await getDocs(collection(db, 'Students'))
      console.log(`   found ${snap.size} students`)
      const basics: StudentMeta[] = snap.docs.map((d) => ({
        abbr: d.id,
        account: (d.data() as any).account,
      }))

      if (!mounted) return
      setStudents(basics.map((b) => ({ ...b, total: 0, upcoming: 0 })))

      const totalCount = basics.length
      await Promise.all(
        basics.map(async (b, i) => {
          const latest = async (col: string) => {
            const snap = await getDocs(
              query(
                collection(db, 'Students', b.abbr, col),
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

          const sessSnap = await getDocs(
            query(collection(db, 'Sessions'), where('sessionName', '==', b.account))
          )
          const total = sessSnap.size
          let upcoming = 0
          const now = new Date()
          await Promise.all(
            sessSnap.docs.map(async (sd) => {
              const logsSnap = await getDocs(
                collection(db, 'Sessions', sd.id, 'appointmentHistory')
              )
              const logs = logsSnap.docs.map((d) => d.data() as any)
              let dt: Date | undefined
              if (logs.length) {
                const toMs = (r: any) => {
                  const date = r.dateStamp?.toDate?.()
                  if (!date) return -Infinity
                  const t = String(r.timeStamp || '000000').padStart(6, '0')
                  return (
                    date.getTime() +
                    parseInt(t.slice(0, 2), 10) * 3600_000 +
                    parseInt(t.slice(2, 4), 10) * 60_000 +
                    parseInt(t.slice(4, 6), 10) * 1000
                  )
                }
                logs.sort((a, b) => toMs(b) - toMs(a))
                const newest = logs[0]
                dt = newest.newDate?.toDate?.() || newest.origDate?.toDate?.()
              } else {
                const sdData = sd.data() as any
                dt = sdData.sessionDate?.toDate?.()
              }
              if (dt && dt > now) upcoming++
            })
          )

          if (!mounted) return
          setStudents((prev) =>
            prev.map((s) =>
              s.abbr === b.abbr ? { ...s, sex, balanceDue, total, upcoming } : s
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
        <Box sx={{ position: 'relative', pb: 8 }}>
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
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Button
            variant="contained"
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              zIndex: 2,
              bgcolor: 'background.paper',
              color: 'text.primary',
            }}
            onClick={openToolsMenu}
          >
            Tools
          </Button>
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
