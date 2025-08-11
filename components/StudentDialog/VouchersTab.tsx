import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { WriteIcon } from './icons'
import VoucherModal from './VoucherModal'

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

interface Row {
  id: string
  Token: number
  effectiveDate?: any
  timestamp: any
  EditedBy?: string
}

export default function VouchersTab({ abbr }: { abbr: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    const path = PATHS.freeMeal(abbr)
    logPath('freeMeal', path)
    const snap = await getDocs(collection(db, path))
    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => {
        const ta =
          a.effectiveDate?.toDate?.()?.getTime() ||
          new Date(a.effectiveDate).getTime() ||
          a.timestamp?.toDate?.()?.getTime() ||
          0
        const tb =
          b.effectiveDate?.toDate?.()?.getTime() ||
          new Date(b.effectiveDate).getTime() ||
          b.timestamp?.toDate?.()?.getTime() ||
          0
        return ta - tb
      })
    setRows(list)
  }

  useEffect(() => {
    load()
  }, [abbr])

  return (
    <Box sx={{ p: 1, textAlign: 'left', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="subtitle1"
          sx={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}
        >
          Session Vouchers
        </Typography>
        <Tooltip title="Add Voucher">
          <IconButton color="primary" onClick={() => setModalOpen(true)}>
            <WriteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
            Token
          </TableCell>
          <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
            Effective Date
          </TableCell>
          <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
            Timestamp
          </TableCell>
          <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
            Edited By
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {r.Token}
              </TableCell>
              <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {formatDate(r.effectiveDate)}
              </TableCell>
              <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {formatDate(r.timestamp)}
              </TableCell>
              <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {r.EditedBy || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <VoucherModal
        abbr={abbr}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          load()
        }}
      />
    </Box>
  )
}
