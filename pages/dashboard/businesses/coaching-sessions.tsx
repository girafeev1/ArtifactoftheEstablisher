// pages/dashboard/businesses/coaching-sessions.tsx

import React, { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
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
} from '@mui/material'
import OverviewTab from '../../../components/StudentDialog/OverviewTab'

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
  const [selected, setSelected] = useState<StudentDetails | null>(null)
  const [serviceMode, setServiceMode] = useState(false)

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
      setLoading(false)

      // 2) then in parallel load each student’s details
      basics.forEach((b) => {
        (async () => {
          // a) latest sex & balanceDue
          const latest = async (col: string) => {
            console.log(`📥 ${b.abbr}/${col}`)
            const snap = await getDocs(
              query(
                collection(db, 'Students', b.abbr, col),
                orderBy('timestamp', 'desc'),
                limit(1)
              )
            )
            if (snap.empty) {
              console.warn(`⚠️ missing ${col} for ${b.abbr}`)
              return undefined
            }
            const val = (snap.docs[0].data() as any)[col]
            console.log(`✅ ${b.abbr} ${col}=${val}`)
            return val
          }
          const [sex, balRaw] = await Promise.all([
            latest('sex'),
            latest('balanceDue'),
          ])
          const balanceDue = parseFloat(balRaw as any) || 0

          // b) scan every session for this student
          console.log(`📥 sessions for ${b.account}`)
          const sessSnap = await getDocs(
            query(collection(db, 'Sessions'), where('sessionName', '==', b.account))
          )
          console.log(`   found ${sessSnap.size} sessions`)
          const total = sessSnap.size
          let upcoming = 0
          const now = new Date()

          // for each session, pull its appointmentHistory subcollection (no Firestore ordering!)
          await Promise.all(
            sessSnap.docs.map(async (sd) => {
              const logsSnap = await getDocs(
                collection(db, 'Sessions', sd.id, 'appointmentHistory')
              )
              console.log(`      logs for ${sd.id}: ${logsSnap.size}`)
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
              s.abbr === b.abbr
                ? { ...s, sex, balanceDue, total, upcoming }
                : s
            )
          )
        })().catch(console.error)
      })
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
          <Typography align="center" sx={{ mt: 1 }}>
            Loading student cards…
          </Typography>
        </Box>
      )}

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
        />
      )}
    </SidebarLayout>
  )
}
