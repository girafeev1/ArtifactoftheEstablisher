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
  Tooltip,
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { RetainerDoc, getRetainerStatus, RetainerStatusColor } from '../../lib/retainer'
import RetainerModal from './RetainerModal'
import { WriteIcon } from './icons'
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'
import IconButton from '@mui/material/IconButton'

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
  account,
  balanceDue,
}: {
  abbr: string
  account: string
  balanceDue: number
}) {
  const [rows, setRows] = useState<RetRow[]>([])
  const [sortAsc, setSortAsc] = useState(false)
  const [modal, setModal] = useState<{
    open: boolean
    retainer?: RetRow
    nextStart?: Date
  }>({ open: false })
  const { data: session } = useSession()
  const userEmail = session?.user?.email || 'anon'
  const columns = [
    { key: 'retainer', width: 120 },
    { key: 'period', width: 200 },
    { key: 'rate', width: 120 },
    { key: 'status', width: 120 },
    { key: 'actions', width: 100 },
  ] as const
  const { widths, startResize, dblClickResize } = useColumnWidths(
    'retainers',
    columns,
    userEmail,
  )

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1, pb: '64px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}
          >
            Retainers
          </Typography>
          <Tooltip title="Add Retainer">
            <IconButton
              color="primary"
              aria-label="Add Retainer"
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
        <Table
          size="small"
          sx={{ tableLayout: 'fixed', width: 'max-content' }}
        >
        <TableHead>
          <TableRow>
            <TableCell
              data-col="retainer"
              sx={{
                fontFamily: 'Cantata One',
                fontWeight: 'bold',
                position: 'relative',
                width: widths['retainer'],
                minWidth: widths['retainer'],
              }}
            >
              <TableSortLabel
                active
                direction={sortAsc ? 'asc' : 'desc'}
                onClick={() => setSortAsc((s) => !s)}
              >
                Retainer
              </TableSortLabel>
              <Box
                className="col-resizer"
                aria-label="Resize column Retainer"
                onMouseDown={(e) => startResize('retainer', e)}
                onDoubleClick={(e) => dblClickResize('retainer', e)}
              />
            </TableCell>
            <TableCell
              data-col="period"
              sx={{
                fontFamily: 'Cantata One',
                fontWeight: 'bold',
                position: 'relative',
                width: widths['period'],
                minWidth: widths['period'],
              }}
            >
              Coverage Period
              <Box
                className="col-resizer"
                aria-label="Resize column Coverage Period"
                onMouseDown={(e) => startResize('period', e)}
                onDoubleClick={(e) => dblClickResize('period', e)}
              />
            </TableCell>
            <TableCell
              data-col="rate"
              sx={{
                fontFamily: 'Cantata One',
                fontWeight: 'bold',
                position: 'relative',
                width: widths['rate'],
                minWidth: widths['rate'],
              }}
            >
              Rate
              <Box
                className="col-resizer"
                aria-label="Resize column Rate"
                onMouseDown={(e) => startResize('rate', e)}
                onDoubleClick={(e) => dblClickResize('rate', e)}
              />
            </TableCell>
            <TableCell
              data-col="status"
              sx={{
                fontFamily: 'Cantata One',
                fontWeight: 'bold',
                position: 'relative',
                width: widths['status'],
                minWidth: widths['status'],
              }}
            >
              Status
              <Box
                className="col-resizer"
                aria-label="Resize column Status"
                onMouseDown={(e) => startResize('status', e)}
                onDoubleClick={(e) => dblClickResize('status', e)}
              />
            </TableCell>
            <TableCell
              data-col="actions"
              sx={{
                fontFamily: 'Cantata One',
                fontWeight: 'bold',
                position: 'relative',
                width: widths['actions'],
                minWidth: widths['actions'],
              }}
            >
              Actions
              <Box
                className="col-resizer"
                aria-label="Resize column Actions"
                onMouseDown={(e) => startResize('actions', e)}
                onDoubleClick={(e) => dblClickResize('actions', e)}
              />
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
                <TableCell
                  data-col="retainer"
                  sx={{
                    fontFamily: 'Newsreader',
                    fontWeight: 500,
                    width: widths['retainer'],
                    minWidth: widths['retainer'],
                  }}
                >
                  {monthLabel}
                </TableCell>
                <TableCell
                  data-col="period"
                  sx={{
                    fontFamily: 'Newsreader',
                    fontWeight: 500,
                    width: widths['period'],
                    minWidth: widths['period'],
                  }}
                >
                  {`${formatDate(r.retainerStarts)} – ${formatDate(r.retainerEnds)}`}
                </TableCell>
                <TableCell
                  data-col="rate"
                  sx={{
                    fontFamily: 'Newsreader',
                    fontWeight: 500,
                    width: widths['rate'],
                    minWidth: widths['rate'],
                  }}
                >
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'HKD',
                    currencyDisplay: 'code',
                  }).format(r.retainerRate)}
                </TableCell>
                <TableCell
                  data-col="status"
                  sx={{
                    fontFamily: 'Newsreader',
                    fontWeight: 500,
                    color: colorMap[status.color],
                    width: widths['status'],
                    minWidth: widths['status'],
                  }}
                >
                  <Tooltip title={status.label}>
                    <span>{status.label}</span>
                  </Tooltip>
                </TableCell>
                <TableCell
                  data-col="actions"
                  sx={{
                    fontFamily: 'Newsreader',
                    fontWeight: 500,
                    width: widths['actions'],
                    minWidth: widths['actions'],
                  }}
                >
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
            account={account}
            balanceDue={balanceDue}
            retainer={modal.retainer}
            nextStart={modal.nextStart}
            open={modal.open}
            onClose={(saved) => {
              setModal({ open: false })
              if (saved) load()
            }}
          />
        )}
      </Box>
    </Box>
  )
}

