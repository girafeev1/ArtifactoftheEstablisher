import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  TableSortLabel,
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { RetainerDoc } from '../../lib/retainer'
import RetainerModal from './RetainerModal'

const formatDate = (v: any) => {
  try {
    const d = v?.toDate ? v.toDate() : new Date(v)
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
  } catch {
    return '-'
  }
}

interface RetRow extends RetainerDoc {
  id: string
}

export default function RetainersTab({
  abbr,
  balanceDue,
}: {
  abbr: string
  balanceDue: number
}) {
  const [rows, setRows] = useState<RetRow[]>([])
  const [sortAsc, setSortAsc] = useState(true)
  const [modal, setModal] = useState<{
    open: boolean
    retainer?: RetRow
    nextStart?: Date
  }>({ open: false })

  const load = async () => {
    try {
      const snap = await getDocs(collection(db, 'Students', abbr, 'Retainers'))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as RetainerDoc) }))
        .sort((a, b) =>
          a.retainerStarts.toDate().getTime() - b.retainerStarts.toDate().getTime(),
        )
      setRows(list)
    } catch (e) {
      console.error('load retainers failed', e)
      setRows([])
    }
  }

  useEffect(() => {
    load()
  }, [abbr])

  const sortedRows = [...rows].sort((a, b) => {
    const diff =
      a.retainerStarts.toDate().getTime() - b.retainerStarts.toDate().getTime()
    return sortAsc ? diff : -diff
  })

  const today = new Date()

  const getStatus = (r: RetRow, idx: number) => {
    const start = r.retainerStarts.toDate()
    const end = r.retainerEnds.toDate()
    const next = rows[idx + 1]
    if (today >= start && today <= end) {
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000)
      if (daysLeft <= 7) {
        if (daysLeft === 7) return { text: 'Expiring in a week', color: 'error.main' }
        if (daysLeft === 1)
          return { text: 'Expiring tomorrow', color: 'error.main' }
        if (daysLeft === 0)
          return { text: 'Expiring today', color: 'error.main' }
        return { text: `Expiring in ${daysLeft} days`, color: 'error.main' }
      }
      return { text: 'Active', color: 'success.main' }
    }
    if (today < start) {
      const days = Math.ceil((start.getTime() - today.getTime()) / 86400000)
      if (days <= 7)
        return { text: `Upcoming in ${days} days`, color: 'info.light' }
      return {
        text: `Upcoming retainer starts on ${formatDate(start)}`,
        color: 'info.light',
      }
    }
    // expired
    if (next) {
      const nextStart = next.retainerStarts.toDate()
      const days = Math.ceil((nextStart.getTime() - today.getTime()) / 86400000)
      if (days <= 7)
        return {
          text: `Upcoming retainer starts in ${days} days`,
          color: 'success.light',
        }
      return {
        text: `Upcoming retainer starts on ${formatDate(nextStart)}`,
        color: 'success.light',
      }
    }
    return { text: 'Expired', color: 'error.main' }
  }

  return (
    <Box sx={{ p: 1, textAlign: 'left', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="subtitle1"
          sx={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}
        >
          Retainers
        </Typography>
        <Button
          variant="contained"
          onClick={() =>
            setModal({
              open: true,
              nextStart: rows[rows.length - 1]
                ? rows[rows.length - 1].retainerEnds.toDate()
                : undefined,
            })
          }
        >
          Add Next Retainer
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
              <TableSortLabel
                active
                direction={sortAsc ? 'asc' : 'desc'}
                onClick={() => setSortAsc((s) => !s)}
              >
                Retainer
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
              Coverage Period
            </TableCell>
            <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
              Rate
            </TableCell>
            <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
              Status
            </TableCell>
            <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((r, idx) => {
            const status = getStatus(r, idx)
            const active = today >= r.retainerStarts.toDate() && today <= r.retainerEnds.toDate()
            return (
              <TableRow key={r.id} hover selected={active}>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {r.id}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {`${formatDate(r.retainerStarts)} – ${formatDate(r.retainerEnds)}`}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'HKD',
                  }).format(r.retainerRate)}
                </TableCell>
                <TableCell
                  sx={{ fontFamily: 'Newsreader', fontWeight: 500, color: status.color }}
                  title={status.text}
                >
                  {status.text}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  <Button
                    size="small"
                    onClick={() => setModal({ open: true, retainer: r })}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {modal.open && (
        <RetainerModal
          abbr={abbr}
          balanceDue={balanceDue}
          retainer={modal.retainer}
          nextStart={modal.nextStart}
          onClose={(saved) => {
            setModal({ open: false })
            if (saved) load()
          }}
        />
      )}
    </Box>
  )
}

