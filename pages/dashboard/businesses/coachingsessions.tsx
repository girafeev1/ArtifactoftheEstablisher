// pages/dashboard/businesses/coachingsessions.tsx

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
   TextField,
   ToggleButtonGroup,
   ToggleButton,
   Dialog,
   DialogTitle,
   DialogContent,
   DialogActions,
   Tabs,
   Tab,
 } from '@mui/material'


import Overview from '../../../components/StudentDialog/Overview'
import Personal from '../../../components/StudentDialog/Personal'
import Sessions from '../../../components/StudentDialog/Sessions'
import Billing from '../../../components/StudentDialog/Billing'

interface StudentMeta { abbr: string; account: string }
interface StudentDetails extends StudentMeta {
  sex?: string
  balanceDue?: number
  total: number
  upcoming: number
}

export default function CoachingSessions() {
  const [students, setStudents] = useState<StudentDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [serviceMode, setServiceMode] = useState(false)
  const [viewMode, setViewMode] = useState<'card'|'list'>('card')
  const [searchTerm, setSearchTerm] = useState('')
  const [tabIndex, setTabIndex] = useState(0)

  useEffect(() => {
    let mounted = true

    async function loadAll() {
      console.log('[CoachingSessions] Fetching Students collection')
      const snap = await getDocs(collection(db, 'Students'))
      const basics = snap.docs.map(d => ({
        abbr:    d.id,
        account: (d.data() as any).account,
      }))
      console.log('[CoachingSessions] Found', basics.length, 'students')

      if (!mounted) return
      setStudents(basics.map(b => ({
        ...b,
        total:      0,
        upcoming:   0,
        sex:        undefined,
        balanceDue: 0,
      })))
      setLoading(false)

      basics.forEach(b => {
        ;(async () => {
          const latest = async (col: string) => {
            const sub = await getDocs(collection(db, 'Students', b.abbr, col))
            return sub.empty ? undefined : (sub.docs[0].data() as any).value
          }
          const [sex, balRaw] = await Promise.all([
            latest('sex'),
            latest('balanceDue'),
          ])
          const balanceDue = parseFloat(balRaw as any) || 0

          const sessSnap = await getDocs(
            query(
              collection(db, 'Sessions'),
              where('sessionName', '==', b.account)
            )
          )

          let total = 0,
            upcoming = 0
          const now = new Date()
          await Promise.all(
            sessSnap.docs.map(async sd => {
              total++
              const histSnap = await getDocs(
                query(
                  collection(db, 'Sessions', sd.id, 'AppointmentHistory'),
                  orderBy('dateStamp', 'desc'),
                  limit(1)
                )
              )
              const hist = histSnap.docs[0]?.data() as any
              const start =
                hist?.newStartTimestamp?.toDate?.() ||
                hist?.origStartTimestamp?.toDate?.()
              if (start && start > now) upcoming++
            })
          )

          if (!mounted) return
          setStudents(prev =>
            prev.map(s =>
              s.abbr === b.abbr
                ? { ...s, sex, balanceDue, total, upcoming }
                : s
            )
          )
          console.log(`[CoachingSessions] Updated ${b.abbr}`, {
            sex,
            balanceDue,
            total,
            upcoming,
          })
        })().catch(console.error)
      })
    }

    loadAll().catch(console.error)
    return () => { mounted = false }
  }, [])

  const filtered = students.filter(s =>
    s.account.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const selectedStudent = students.find(s => s.abbr === selected)

  return (
    <SidebarLayout>
      {/* header */}
      <Box sx={{ p:3, display:'flex', alignItems:'center', gap:2 }}>
        <Typography variant="h4" sx={{ flexGrow:1 }}>
          Coaching Sessions
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_,v) => v && setViewMode(v)}
        >
          <ToggleButton value="card">Card</ToggleButton>
          <ToggleButton value="list">List</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          placeholder="Search…"
          size="small"
          onChange={e => setSearchTerm(e.target.value)}
        />
      </Box>

      {/* loading */}
      {loading && (
        <Box sx={{ width:'100%' }}>
          <LinearProgress />
          <Typography align="center" sx={{ mt:1 }}>
            Loading students…
          </Typography>
        </Box>
      )}

      {/* card view */}
      {!loading && viewMode === 'card' && (
        <Grid container spacing={2} sx={{ mt:2 }}>
          {filtered.map(s => (
            <Grid item xs={12} sm={6} md={4} key={s.abbr}>
              <Card>
                <CardActionArea onClick={() => setSelected(s.abbr)}>
                  <CardContent>
                    <Typography variant="h6">{s.account}</Typography>
                    <Typography>
                      {s.sex ?? '–'} • Due: ${(s.balanceDue||0).toFixed(2)}
                    </Typography>
                    <Typography>
                      Total: {s.total}{s.upcoming>0?` → ${s.upcoming}`:''}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* list view */}
      {!loading && viewMode === 'list' && (
        <Box
          sx={{
            mt:2, px:3,
            overflowY:'auto',
            maxHeight:'calc(100vh - 200px)'
          }}
        >
          {filtered.map(s => (
            <Box
              key={s.abbr}
              p={2} mb={1}
              border="1px solid #eee" borderRadius={1}
              sx={{ cursor:'pointer' }}
              onClick={() => setSelected(s.abbr)}
            >
              <Typography>
                <strong>{s.account}</strong> ({s.abbr})
              </Typography>
              <Typography variant="body2">
                {s.sex ?? '–'} • Due: ${(s.balanceDue||0).toFixed(2)} •
                Total: {s.total}{s.upcoming>0?` → ${s.upcoming}`:''}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* service mode */}
      <Button
        variant="contained"
        sx={{
          position:'fixed', bottom:16, right:16,
          bgcolor: serviceMode?'error.main':'primary.main'
        }}
        onClick={() => setServiceMode(m=>!m)}
      >
        Service Mode
      </Button>

      {/* dialog + right‐side sidebar nav */}
      {selected && selectedStudent && (
        <Dialog
          open
          onClose={() => { setSelected(null); setTabIndex(0) }}
          fullWidth maxWidth="md"
        >
          <DialogTitle>
            {selectedStudent.account}
          </DialogTitle>
          <DialogContent>
            <Box display="flex" minHeight={400}>
              {/* content pane */}
              <Box flexGrow={1} p={2} overflow="auto">
                {tabIndex === 0 && (
                  <Overview abbr={selected} serviceMode={serviceMode} />
                )}
                {tabIndex === 1 && (
                  <Personal abbr={selected} serviceMode={serviceMode} />
                )}
                {tabIndex === 2 && (
                  <Sessions abbr={selected} serviceMode={serviceMode} />
                )}
                {tabIndex === 3 && (
                  <Billing abbr={selected} serviceMode={serviceMode} />
                )}
              </Box>
            {/* right‐hand vertical tabs */}
            <Box
              sx={{
                borderLeft: 1,
                borderColor: 'divider',
                minWidth: 150
              }}
            >
              <Tabs
                orientation="vertical"
                value={tabIndex}
                onChange={(_e, i) => setTabIndex(i)}
                aria-label="Student dialog tabs"
                sx={{ height: '100%' }}
              >
                <Tab label="Overview" />
                <Tab label="Personal" />
                <Tab label="Sessions" />
                <Tab label="Billing" />
              </Tabs>
            </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </SidebarLayout>
  )
}
