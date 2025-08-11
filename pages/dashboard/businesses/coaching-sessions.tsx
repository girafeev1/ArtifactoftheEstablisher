// pages/dashboard/businesses/coaching-sessions.tsx

import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
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

          const [
            sex,
            paymentsSnap,
            sessSnap,
            retSnap,
            histSnap,
            baseSnap,
          ] = await Promise.all([
            latest('sex'),
            (async () => {
              const p = PATHS.payments(b.abbr)
              logPath('payments', p)
              return getDocs(collection(db, p))
            })(),
            (async () => {
              logPath('sessionsQuery', PATHS.sessions)
              return getDocs(
                query(
                  collection(db, PATHS.sessions),
                  where('sessionName', '==', b.account),
                ),
              )
            })(),
            (async () => {
              const p = PATHS.retainers(b.abbr)
              logPath('retainers', p)
              return getDocs(collection(db, p))
            })(),
            (async () => {
              const p = PATHS.baseRateHistory(b.abbr)
              logPath('baseRateHistory', p)
              return getDocs(collection(db, p))
            })(),
            (async () => {
              const p = PATHS.baseRate(b.abbr)
              logPath('baseRate', p)
              return getDocs(collection(db, p))
            })(),
          ])

          const baseRateDocs = [...histSnap.docs, ...baseSnap.docs]
          const baseRates = baseRateDocs
            .map((d) => {
              const data = d.data() as any
              return {
                rate: data.rate ?? data.baseRate,
                ts: data.timestamp?.toDate?.() ?? new Date(0),
              }
            })
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())

          const retainers = retSnap.docs.map((d) => {
            const data = d.data() as any
            return {
              start: data.retainerStarts?.toDate?.() ?? new Date(data.retainerStarts),
              end: data.retainerEnds?.toDate?.() ?? new Date(data.retainerEnds),
            }
          })

          const sessions = await Promise.all(
            sessSnap.docs.map(async (sd) => {
              const data = sd.data() as any
              const startDate = await computeSessionStart(sd.id, data)
              const ratePath = PATHS.sessionRate(sd.id)
              const payPath = PATHS.sessionPayment(sd.id)
              logPath('sessionRate', ratePath)
              logPath('sessionPayment', payPath)
              const [rateSnap, paySnap] = await Promise.all([
                getDocs(collection(db, ratePath)),
                getDocs(collection(db, payPath)),
              ])

              const base = (() => {
                if (!startDate || !baseRates.length) return 0
                const entry = baseRates
                  .filter((b) => b.ts.getTime() <= startDate.getTime())
                  .pop()
                return entry ? Number(entry.rate) || 0 : 0
              })()

              const rateHist = rateSnap.docs
                .map((d) => d.data() as any)
                .sort((a, b) => {
                  const ta = a.timestamp?.toDate?.() ?? new Date(0)
                  const tb = b.timestamp?.toDate?.() ?? new Date(0)
                  return tb.getTime() - ta.getTime()
                })
              const latestRate = rateHist[0]?.rateCharged
              const rate = latestRate != null ? Number(latestRate) : base

              const paymentIds = paySnap.docs.map(
                (p) => (p.data() as any).paymentId as string,
              )
              const assigned = paymentIds.length > 0
              const covered = retainers.some(
                (r) => startDate && startDate >= r.start && startDate <= r.end,
              )
              return { startDate, rate, assigned, covered }
            }),
          )

          const total = sessSnap.size
          const now = new Date()
          let upcoming = 0
          sessions.forEach((s) => {
            if (s.startDate && s.startDate > now) upcoming++
          })

          const totalOwed = sessions.reduce(
            (sum, s) => sum + (s.rate || 0),
            0,
          )
          const totalPaid = paymentsSnap.docs.reduce(
            (sum, d) => sum + (Number((d.data() as any).amount) || 0),
            0,
          )
          const balanceDue = totalOwed - totalPaid

          if (!mounted) return
          setStudents((prev) =>
            prev.map((s) =>
              s.abbr === b.abbr
                ? { ...s, sex, balanceDue, total, upcoming }
                : s,
            ),
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
