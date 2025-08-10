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
  IconButton,
  Tooltip,
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { RetainerDoc, getRetainerStatus, RetainerStatusColor } from '../../lib/retainer'
import RetainerModal from './RetainerModal'
import { WriteIcon } from './icons'

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
  const [sortAsc, setSortAsc] = useState(false)
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
  const nextFuture = [...rows]
    .map((r) => ({ row: r, s: r.retainerStarts.toDate() }))
    .filter((r) => r.s > today)
    .sort((a, b) => a.s.getTime() - b.s.getTime())[0]?.row

  return (
    <Box sx={{ p: 1, textAlign: 'left', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="subtitle1"
          sx={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}
        >
          Retainers
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => setModal({ open: true })}
          >
            Add New Retainer
          </Button>
          <Tooltip title="Add Next Retainer">
            <IconButton
              color="primary"
              onClick={() =>
                setModal({
                  open: true,
                  nextStart: rows[rows.length - 1]
                    ? rows[rows.length - 1].retainerEnds.toDate()
                    : undefined,
                })
              }
            >
              <WriteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
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
          {sortedRows.map((r) => {
            const start = r.retainerStarts.toDate()
            const end = r.retainerEnds.toDate()
            let status
            if (today < start) status = getRetainerStatus(r, today)
            else if (today <= end) status = getRetainerStatus(r, today)
            else status = getRetainerStatus(r, today, nextFuture)
            const colorMap: Record<RetainerStatusColor, string> = {
              green: 'success.main',
              red: 'error.main',
              lightBlue: 'info.light',
              lightGreen: 'success.light',
            }
            const active = today >= start && today <= end
            const labelDate = new Date(start)
            if (labelDate.getDate() >= 21)
              labelDate.setMonth(labelDate.getMonth() + 1)
            const monthLabel = labelDate.toLocaleString('en-US', {
              month: 'short',
              year: 'numeric',
            })
            return (
              <TableRow key={r.id} hover selected={active}>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {monthLabel}
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
                  sx={{
                    fontFamily: 'Newsreader',
                    fontWeight: 500,
                    color: colorMap[status.color],
                  }}
                >
                  <Tooltip title={status.label}>
                    <span>{status.label}</span>
                  </Tooltip>
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

