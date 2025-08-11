// components/common/InlineEdit.tsx

import React, { useState, useRef, useEffect } from 'react'
import { TextField, MenuItem, Typography } from '@mui/material'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface InlineEditProps {
  value: any
  fieldPath: string       // e.g. "Students/KT/sex"
  fieldKey?: string       // field name stored in the subcollection document
  editable: boolean
  serviceMode?: boolean
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
  onSaved?: (v: any) => void
  displayFormatter?: (v: any) => string
}

export default function InlineEdit({
  value,
  fieldPath,
  fieldKey = 'value',
  editable,
  serviceMode = false,
  type,
  options,
  onSaved,
  displayFormatter,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  // focus when entering edit
  useEffect(() => {
    if (editing && ref.current) ref.current.focus()
  }, [editing])

  useEffect(() => {
    setDraft(value)
  }, [value])

  const save = async (v: any) => {
    const [col, docId, collectionName] = fieldPath.split('/')
    try {
      const snap = await getDocs(collection(db, col, docId, collectionName))
      const idx = String(snap.size + 1).padStart(3, '0')
      const today = new Date()
      const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
      const fieldNumbers: Record<string, string> = {
        firstName: 'A1',
        lastName: 'A2',
        sex: 'A3',
        birthDate: 'A4',
        billingCompany: 'B1',
        defaultBillingType: 'B2',
        baseRate: 'B3',
        lastPaymentDate: 'B5',
        balanceDue: 'B6',
        voucherBalance: 'B7',
        Token: 'FM',
        rateCharged: 'RC',
      }
      const num = fieldNumbers[fieldKey ?? ''] || 'XX'
      const docName = `${docId}-${num}-${idx}-${yyyyMMdd}`
      console.log(
        `💾 add ${col}/${docId}/${collectionName}/${docName} ${fieldKey}=${v}`,
      )
      await setDoc(doc(db, col, docId, collectionName, docName), {
        [fieldKey]: v,
        timestamp: today,
      })
      setDraft(v)
      onSaved?.(v)
    } catch (e) {
      console.error('Save failed', e)
    }
  }

  const allowEdit = editable && (serviceMode || value === undefined || value === '')

  // — you wanted **all** history when in Service Mode —
  const showHistory = async () => {
    const [col, docId, subcol] = fieldPath.split('/')
    console.log(`📥 history ${col}/${docId}/${subcol}`)
    const snap = await getDocs(collection(db, col, docId, subcol))
    console.log(`   ${snap.size} records`)
    const lines = snap.docs.map((d) => {
      const dta = d.data() as any
      const ts = dta.timestamp?.toDate?.().toLocaleString() || 'no-time'
      const [k, v] = Object.entries(dta).find(([k]) => k !== 'timestamp') || [
        'value',
        '',
      ]
      return `${String(v)} @ ${ts}`
    })
    alert(lines.join('\n') || 'No history')
  }

  const display = () => {
    if (draft === '__ERROR__') return 'Error'
    if (draft === undefined || draft === null || draft === '')
      return type === 'number' || type === 'date' ? '-' : 'N/A'
    if (type === 'date') {
      const d = new Date(draft)
      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString()
    }
    const val = String(draft)
    return displayFormatter ? displayFormatter(draft) : val
  }

  // when Service Mode is ON, disable edits and clicking shows full audit trail
  if (!allowEdit && serviceMode) {
    return (
      <Typography
        variant="h6"
        sx={{ cursor: 'pointer', fontFamily: 'Newsreader', fontWeight: 500 }}
        onClick={showHistory}
      >
        {display()}
      </Typography>
    )
  }

  if (!allowEdit) {
    return (
      <Typography variant="h6" sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
        {display()}
      </Typography>
    )
  }

  return editing ? (
    type === 'select' ? (
      <TextField
        select
        inputRef={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) {
            if (window.confirm('Save changes?')) {
              save(draft)
            } else {
              setDraft(value)
            }
          }
          setEditing(false)
        }}
        size="small"
      >
        {options?.map(o => (
          <MenuItem key={o} value={o}>{o}</MenuItem>
        ))}
      </TextField>
    ) : (
      <TextField
        type={type}
        inputRef={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) {
            if (window.confirm('Save changes?')) {
              save(draft)
            } else {
              setDraft(value)
            }
          }
          setEditing(false)
        }}
        size="small"
      />
    )
  ) : (
    <Typography
      variant="h6"
      sx={{ cursor: 'pointer', fontFamily: 'Newsreader', fontWeight: 500 }}
      onClick={() => {
        if (allowEdit) setEditing(true)
      }}
    >
      {display() || '[click to edit]'}
    </Typography>
  )
}
