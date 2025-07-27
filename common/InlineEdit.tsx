// components/common/InlineEdit.tsx

import React, { useState, useRef, useEffect } from 'react'
import { TextField, MenuItem, Typography } from '@mui/material'
import { doc, updateDoc, collection, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface InlineEditProps {
  value: any
  fieldPath: string       // e.g. "Students/KT/firstName"
  editable: boolean
  serviceMode?: boolean
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
}

export default function InlineEdit({
  value,
  fieldPath,
  editable,
  serviceMode = false,
  type,
  options,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  // focus when entering edit
  useEffect(() => {
    if (editing && ref.current) ref.current.focus()
  }, [editing])

  const save = async (v: any) => {
    const [col, docId, field] = fieldPath.split('/')
    try {
      console.log(`💾 update ${col}/${docId} ${field}=${v}`)
      await updateDoc(doc(db, col, docId), {
        [field]: v,
        timestamp: new Date(),
      })
      setDraft(v)
    } catch (e) {
      console.error('Save failed', e)
    }
  }

  // — you wanted **all** history when in Service Mode —
  const showHistory = async () => {
    const [col, docId, field] = fieldPath.split('/')
    // **removed** limit(10) so we fetch _all_ history
    console.log(`📥 history ${col}/${docId}/${field}`)
    const snap = await getDocs(
      collection(db, col, docId, field)
    )
    console.log(`   ${snap.size} records`)
    const lines = snap.docs.map(d => {
      const dta = d.data() as any
      const ts = dta.timestamp?.toDate?.().toLocaleString() || 'no-time'
      return `${String(dta.value)} @ ${ts}`
    })
    alert(lines.join('\n') || 'No history')
  }

  const display = () => {
    if (type === 'date' && draft) return new Date(draft).toLocaleDateString()
    return String(draft ?? '')
  }

  // when Service Mode is ON, disable edits and clicking shows full audit trail
  if (!editable && serviceMode) {
    return (
      <Typography
        sx={{ cursor: 'pointer' }}
        onClick={showHistory}
      >
        {display()}
      </Typography>
    )
  }

  if (!editable) {
    return <Typography>{display()}</Typography>
  }

  return editing ? (
    type === 'select' ? (
      <TextField
        select
        inputRef={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { save(draft); setEditing(false) }}
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
        onBlur={() => { save(draft); setEditing(false) }}
        size="small"
      />
    )
  ) : (
    <Typography
      sx={{ cursor: 'pointer' }}
      onClick={() => { if (!serviceMode) setEditing(true) }}
    >
      {display() || '[click to edit]'}
    </Typography>
  )
}
