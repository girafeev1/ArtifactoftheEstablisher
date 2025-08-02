// components/StudentDialog/PersonalTab.tsx

import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  Stack,
} from '@mui/material'
import InlineEdit from '../../common/InlineEdit'
import { collection, getDocs, query, orderBy, limit, doc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

// PersonalTab owns all personal information for a student. It fetches the
// latest values from Firestore and streams key fields upward to OverviewTab via
// `onPersonal` so OverviewTab can present them without duplicating logic.

const REGION_OPTIONS = ['Hong Kong', 'Kowloon', 'New Territories']

export default function PersonalTab({
  abbr,
  serviceMode,
  onPersonal,
}: {
  abbr: string
  serviceMode: boolean
  onPersonal?: (p: Partial<{ firstName: string; lastName: string; sex: string; birthDate: string }>) => void
}) {
  const [fields, setFields] = useState<any>({
    firstName: '',
    lastName: '',
    sex: '',
    birthDate: '',
    hkid: '',
    contactNumber: { countryCode: '', phoneNumber: '' },
    emailAddress: '',
    address: {
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      district: '',
      region: '',
    },
  })

  const [loading, setLoading] = useState<any>({
    firstName: true,
    lastName: true,
    sex: true,
    birthDate: true,
    hkid: true,
    contactNumber: true,
    emailAddress: true,
    address: true,
  })

  // helper to load latest doc from a subcollection
  const loadLatest = async (sub: string) => {
    const snap = await getDocs(
      query(collection(db, 'Students', abbr, sub), orderBy('timestamp', 'desc'), limit(1)),
    )
    return snap.empty ? null : snap.docs[0].data()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const basicFields = ['firstName', 'lastName', 'sex', 'birthDate']
      await Promise.all(
        basicFields.map(async (f) => {
          const data = await loadLatest(f)
          if (cancelled) return
          const val = data ? (data as any)[f] : ''
          setFields((p: any) => ({ ...p, [f]: val }))
          setLoading((l: any) => ({ ...l, [f]: false }))
          onPersonal?.({ [f]: val })
        }),
      )

      const hkidData = await loadLatest('HKID')
      if (!cancelled) {
        setFields((p: any) => ({ ...p, hkid: hkidData?.idNumber || '' }))
        setLoading((l: any) => ({ ...l, hkid: false }))
      }

      const phoneData = await loadLatest('contactNumber')
      if (!cancelled) {
        setFields((p: any) => ({
          ...p,
          contactNumber: {
            countryCode: phoneData?.countryCode || '',
            phoneNumber: phoneData?.phoneNumber || '',
          },
        }))
        setLoading((l: any) => ({ ...l, contactNumber: false }))
      }

      const emailData = await loadLatest('emailAddress')
      if (!cancelled) {
        setFields((p: any) => ({ ...p, emailAddress: emailData?.emailAddress || '' }))
        setLoading((l: any) => ({ ...l, emailAddress: false }))
      }

      const addrData = await loadLatest('Address')
      if (!cancelled) {
        setFields((p: any) => ({
          ...p,
          address: {
            addressLine1: addrData?.addressLine1 || '',
            addressLine2: addrData?.addressLine2 || '',
            addressLine3: addrData?.addressLine3 || '',
            district: addrData?.district || '',
            region: addrData?.region || '',
          },
        }))
        setLoading((l: any) => ({ ...l, address: false }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, onPersonal])

  const age = (() => {
    if (!fields.birthDate) return ''
    const bd = new Date(fields.birthDate)
    if (isNaN(bd.getTime())) return ''
    const diff = Date.now() - bd.getTime()
    return String(Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)))
  })()

  const saveCustom = async (
    sub: string,
    prefix: string,
    data: Record<string, any>,
    onDone: (d: any) => void,
  ) => {
    try {
      const snap = await getDocs(collection(db, 'Students', abbr, sub))
      const idx = String(snap.size + 1).padStart(3, '0')
      const today = new Date()
      const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
      const docName = `${abbr}-${prefix}-${idx}-${yyyyMMdd}`
      await setDoc(doc(db, 'Students', abbr, sub, docName), {
        ...data,
        timestamp: today,
      })
      onDone(data)
    } catch (e) {
      console.error('Save failed', e)
    }
  }

  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState({ countryCode: '', phoneNumber: '' })
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [editingAddr, setEditingAddr] = useState(false)
  const [addrDraft, setAddrDraft] = useState({
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    district: '',
    region: '',
  })
  const [editingHKID, setEditingHKID] = useState(false)
  const [hkidDraft, setHkidDraft] = useState('')

  // handlers for editing start
  useEffect(() => {
    if (editingPhone)
      setPhoneDraft({ ...fields.contactNumber })
    if (editingEmail) setEmailDraft(fields.emailAddress || '')
    if (editingAddr) setAddrDraft({ ...fields.address })
    if (editingHKID) setHkidDraft(fields.hkid || '')
  }, [editingPhone, editingEmail, editingAddr, editingHKID])

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Personal Information
      </Typography>
      {['firstName', 'lastName'].map((k) => (
        <Box key={k} mb={2}>
          <Typography variant="subtitle2">{k === 'firstName' ? 'First Name' : 'Second Name'}</Typography>
          {loading[k] ? (
            <Typography variant="h6">Loading…</Typography>
          ) : (
            <InlineEdit
              value={fields[k]}
              fieldPath={`Students/${abbr}/${k}`}
              fieldKey={k}
              editable
              serviceMode={serviceMode}
              type="text"
              onSaved={(v) => {
                setFields((p: any) => ({ ...p, [k]: v }))
                onPersonal?.({ [k]: v })
              }}
            />
          )}
        </Box>
      ))}
      <Box mb={2}>
        <Typography variant="subtitle2">Gender</Typography>
        {loading.sex ? (
          <Typography variant="h6">Loading…</Typography>
        ) : (
          <InlineEdit
            value={fields.sex}
            fieldPath={`Students/${abbr}/sex`}
            fieldKey="sex"
            editable
            serviceMode={serviceMode}
            type="select"
            options={['Male', 'Female', 'Other']}
            onSaved={(v) => {
              setFields((p: any) => ({ ...p, sex: v }))
              onPersonal?.({ sex: v })
            }}
          />
        )}
      </Box>
      <Box mb={2}>
        <Typography variant="subtitle2">Age</Typography>
        <Typography variant="h6">{age || '–'}</Typography>
      </Box>
      <Box mb={2}>
        <Typography variant="subtitle2">Birth Date</Typography>
        {loading.birthDate ? (
          <Typography variant="h6">Loading…</Typography>
        ) : (
          <InlineEdit
            value={fields.birthDate}
            fieldPath={`Students/${abbr}/birthDate`}
            fieldKey="birthDate"
            editable
            serviceMode={serviceMode}
            type="date"
            onSaved={(v) => {
              setFields((p: any) => ({ ...p, birthDate: v }))
              onPersonal?.({ birthDate: v })
            }}
          />
        )}
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        ID no.
      </Typography>
      <Box mb={2}>
        <Typography variant="subtitle2">HKID No.</Typography>
        {loading.hkid ? (
          <Typography variant="h6">Loading…</Typography>
        ) : editingHKID ? (
          <TextField
            value={hkidDraft}
            onChange={(e) => setHkidDraft(e.target.value)}
            onBlur={() => {
              if (hkidDraft !== fields.hkid) {
                saveCustom('HKID', 'hkid', { idNumber: hkidDraft }, () => {
                  setFields((p: any) => ({ ...p, hkid: hkidDraft }))
                })
              }
              setEditingHKID(false)
            }}
            size="small"
          />
        ) : (
          <Typography
            variant="h6"
            sx={{ cursor: 'pointer' }}
            onClick={() => setEditingHKID(true)}
          >
            {fields.hkid || '[click to edit]'}
          </Typography>
        )}
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Contact Information
      </Typography>

      {/* Contact Number */}
      <Box mb={2}>
        <Typography variant="subtitle2">Contact Number</Typography>
        {loading.contactNumber ? (
          <Typography variant="h6">Loading…</Typography>
        ) : editingPhone ? (
          <Stack direction="row" spacing={1}>
            <TextField
              label="Country Code"
              type="number"
              value={phoneDraft.countryCode}
              onChange={(e) => setPhoneDraft((p) => ({ ...p, countryCode: e.target.value }))}
              size="small"
            />
            <TextField
              label="Phone Number"
              type="number"
              value={phoneDraft.phoneNumber}
              onChange={(e) => setPhoneDraft((p) => ({ ...p, phoneNumber: e.target.value }))}
              size="small"
            />
            <Button
              onClick={() => {
                saveCustom(
                  'contactNumber',
                  'phone',
                  {
                    countryCode: Number(phoneDraft.countryCode) || 0,
                    phoneNumber: Number(phoneDraft.phoneNumber) || 0,
                  },
                  (d) => {
                    setFields((p: any) => ({ ...p, contactNumber: d }))
                  },
                )
                setEditingPhone(false)
              }}
            >
              Save
            </Button>
          </Stack>
        ) : (
          <Typography
            variant="h6"
            sx={{ cursor: 'pointer' }}
            onClick={() => setEditingPhone(true)}
          >
            {fields.contactNumber.countryCode || fields.contactNumber.phoneNumber
              ? `+${fields.contactNumber.countryCode} ${fields.contactNumber.phoneNumber}`
              : '[click to edit]'}
          </Typography>
        )}
      </Box>

      {/* Email Address */}
      <Box mb={2}>
        <Typography variant="subtitle2">Email Address</Typography>
        {loading.emailAddress ? (
          <Typography variant="h6">Loading…</Typography>
        ) : editingEmail ? (
          <Stack direction="row" spacing={1}>
            <TextField
              label="Email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              size="small"
            />
            <Button
              onClick={() => {
                const valid = /.+@.+\..+/.test(emailDraft)
                if (!valid) {
                  alert('Invalid email')
                  return
                }
                saveCustom('emailAddress', 'email', { emailAddress: emailDraft }, (d) => {
                  setFields((p: any) => ({ ...p, emailAddress: d.emailAddress }))
                })
                setEditingEmail(false)
              }}
            >
              Save
            </Button>
          </Stack>
        ) : (
          <Typography
            variant="h6"
            sx={{ cursor: 'pointer' }}
            onClick={() => setEditingEmail(true)}
          >
            {fields.emailAddress || '[click to edit]'}
          </Typography>
        )}
      </Box>

      {/* Contact Address */}
      <Box mb={2}>
        <Typography variant="subtitle2">Contact Address</Typography>
        {loading.address ? (
          <Typography variant="h6">Loading…</Typography>
        ) : editingAddr ? (
          <Box>
            <TextField
              label="Address Line 1"
              fullWidth
              value={addrDraft.addressLine1}
              onChange={(e) => setAddrDraft((p) => ({ ...p, addressLine1: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              label="Address Line 2"
              fullWidth
              value={addrDraft.addressLine2}
              onChange={(e) => setAddrDraft((p) => ({ ...p, addressLine2: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              label="Address Line 3"
              fullWidth
              value={addrDraft.addressLine3}
              onChange={(e) => setAddrDraft((p) => ({ ...p, addressLine3: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              label="District"
              fullWidth
              value={addrDraft.district}
              onChange={(e) => setAddrDraft((p) => ({ ...p, district: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              select
              label="Region"
              fullWidth
              value={addrDraft.region}
              onChange={(e) => setAddrDraft((p) => ({ ...p, region: e.target.value }))}
              sx={{ mb: 1 }}
            >
              {REGION_OPTIONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>
            <Button
              onClick={() => {
                saveCustom('Address', 'address', addrDraft, (d) => {
                  setFields((p: any) => ({ ...p, address: d }))
                })
                setEditingAddr(false)
              }}
            >
              Save
            </Button>
          </Box>
        ) : (
          <Box sx={{ cursor: 'pointer' }} onClick={() => setEditingAddr(true)}>
            <Typography variant="h6">
              {[fields.address.addressLine1, fields.address.addressLine2, fields.address.addressLine3]
                .filter(Boolean)
                .join(', ') || '[click to edit]'}
            </Typography>
            {fields.address.district && (
              <Typography variant="h6">{fields.address.district}</Typography>
            )}
            {fields.address.region && (
              <Typography variant="h6">{fields.address.region}</Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

