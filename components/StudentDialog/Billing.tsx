// components/StudentDialog/Billing.tsx

import React, { useEffect, useState } from 'react'
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore'
import { getDb } from '../../lib/firebase'
import { Box, Typography, CircularProgress, List, ListItem, ListItemText } from '@mui/material'

interface Props {
  abbr: string
  serviceMode: boolean
}

interface BillingTypeChange { date?: any; type?: string }
interface RateChange       { date?: any; rate?: number }
interface Retainer         { start?: any; end?: any; rate?: number }
interface PaymentHistory   { date?: any; amount?: number }
interface VoucherChange    { date?: any; balance?: number }

export default function Billing({ abbr, serviceMode }: Props) {
  const [data, setData] = useState<any>(null)
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getDb().then(db => {
      if (!db) { setLoading(false); return }

    // 1) fetch root student doc
    getDoc(doc(db, 'Students', abbr))
      .then(snap => {
        if (mounted && snap.exists()) setData(snap.data())
      })

    // 2) fetch payments subcollection (hypothetical path)
    getDocs(query(collection(db, 'Students', abbr, 'payments'), orderBy('date','desc')))
      .then(snap => {
        if (!mounted) return
        setPaymentHistory(
          snap.docs.map(d => {
            const doc = d.data() as any
            return { date: doc.date, amount: doc.amount }
          })
        )
      })
      .catch(() => { /* no payments */ })
      .finally(() => mounted && setLoading(false))
    })

    return () => { mounted = false }
  }, [abbr])

  if (loading) {
    return <Box textAlign="center" py={4}><CircularProgress /></Box>
  }
  if (!data) {
    return <Typography>No billing info available.</Typography>
  }

  // extract stub fields
  const bc: string               = data.billingCompany   ?? '–'
  const balanceDue: number       = data.balanceDue       ?? 0
  const lastPayment: any         = (paymentHistory[0]?.date) ?? null

  return (
    <Box>
      <Typography><strong>Billing Company:</strong> {bc}</Typography>

      <Typography sx={{ mt: 2 }}><strong>Billing Type History:</strong></Typography>
      <List dense>
        { (data.billingTypeChanges as BillingTypeChange[] || []).map((c,i) => (
          <ListItem key={i}>
            <ListItemText
              primary={c.type ?? '–'}
              secondary={c.date?.toDate().toLocaleDateString() ?? ''}
            />
          </ListItem>
        )) }
        {!(data.billingTypeChanges?.length) && <Typography>–</Typography>}
      </List>

      <Typography sx={{ mt: 2 }}><strong>Base Rate History:</strong></Typography>
      <List dense>
        { (data.baseRateChanges as RateChange[] || []).map((r,i) => (
          <ListItem key={i}>
            <ListItemText
              primary={`$${r.rate?.toFixed(2) ?? '–'}`}
              secondary={r.date?.toDate().toLocaleDateString() ?? ''}
            />
          </ListItem>
        )) }
        {!(data.baseRateChanges?.length) && <Typography>–</Typography>}
      </List>

      <Typography sx={{ mt: 2 }}><strong>Retainer Status:</strong></Typography>
      <List dense>
        { (data.retainerStatus as Retainer[] || []).map((r,i) => (
          <ListItem key={i}>
            <ListItemText
              primary={`$${r.rate?.toFixed(2) ?? '–'}`}
              secondary={
                `${r.start?.toDate().toLocaleDateString() ?? ''} → ` +
                `${r.end?.toDate().toLocaleDateString()   ?? ''}`
              }
            />
          </ListItem>
        )) }
        {!(data.retainerStatus?.length) && <Typography>–</Typography>}
      </List>

      <Typography sx={{ mt: 2 }}>
        <strong>Last Payment Made:</strong>{' '}
        { lastPayment?.toDate
          ? lastPayment.toDate().toLocaleDateString()
          : '–'}
      </Typography>

      <Typography sx={{ mt: 2 }}>
        <strong>Balance Due:</strong> ${balanceDue.toFixed(2)}
      </Typography>
      <Typography variant="caption" display="block">
        (Click below to view payment history)
      </Typography>
      <List dense>
        {paymentHistory.map((p,i) => (
          <ListItem key={i}>
            <ListItemText
              primary={`$${p.amount?.toFixed(2) ?? 0}`}
              secondary={p.date?.toDate().toLocaleDateString() ?? ''}
            />
          </ListItem>
        ))}
      </List>

      <Typography sx={{ mt: 2 }}><strong>Voucher Balance History:</strong></Typography>
      <List dense>
        { (data.voucherChanges as VoucherChange[] || []).map((v,i) => (
          <ListItem key={i}>
            <ListItemText
              primary={`$${v.balance?.toFixed(2) ?? '–'}`}
              secondary={v.date?.toDate().toLocaleDateString() ?? ''}
            />
          </ListItem>
        )) }
        {!(data.voucherChanges?.length) && <Typography>–</Typography>}
      </List>

      {serviceMode && (
        <Typography color="secondary" sx={{ mt: 1 }}>
          Service Mode ON
        </Typography>
      )}
    </Box>
  )
}
