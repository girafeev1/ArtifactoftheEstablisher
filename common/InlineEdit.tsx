// components/common/InlineEdit.tsx

import React, { useState, useRef, useEffect } from 'react'
import { TextField, MenuItem, Typography } from '@mui/material'
import { addDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface InlineEditProps {
  value: any
  fieldPath: string       // e.g. "Students/KT/sex"
  fieldKey?: string       // field name stored in the subcollection document
  editable: boolean
  serviceMode?: boolean
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
}

export default function InlineEdit({
  value,
  fieldPath,
  fieldKey = 'value',
  editable,
  serviceMode = false,
  type,
  options,
}: InlineEditProps) {
  const [editing, setEditing] = useState(value === undefined || value === '')
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  // focus when entering edit
  useEffect(() => {
    if (editing && ref.current) ref.current.focus()
  }, [editing])

  useEffect(() => {
    setDraft(value)
    if (value === undefined || value === '') {
      setEditing(true)
    }
  }, [value])

  const save = async (v: any) => {
    const [col, docId, collectionName] = fieldPath.split('/')
    try {
      console.log(`💾 add ${col}/${docId}/${collectionName} ${fieldKey}=${v}`)
      await addDoc(collection(db, col, docId, collectionName), {
        [fieldKey]: v,
        timestamp: new Date(),
      })
      setDraft(v)
    } catch (e) {
      console.error('Save failed', e)
    }
  }

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
