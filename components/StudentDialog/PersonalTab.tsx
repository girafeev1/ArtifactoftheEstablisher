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

console.log('=== StudentDialog loaded version 1.1 ===')

// PersonalTab owns all personal information for a student. It fetches the
// latest values from Firestore and streams key fields upward to OverviewTab via
// `onPersonal` so OverviewTab can present them without duplicating logic.

const REGION_OPTIONS = ['Hong Kong', 'Kowloon', 'New Territories']

export default function PersonalTab({
  abbr,
  serviceMode,
  onPersonal,
  style,
}: {
  abbr: string
  serviceMode: boolean
  onPersonal?: (p: Partial<{ firstName: string; lastName: string; sex: string; birthDate: string }>) => void
  style?: React.CSSProperties
}) {
  console.log('Rendering PersonalTab for', abbr)
  const [fields, setFields] = useState<any>({
    firstName: undefined,
    lastName: undefined,
    sex: undefined,
    birthDate: undefined,
    hkid: undefined,
    contactNumber: { countryCode: undefined, phoneNumber: undefined },
    emailAddress: undefined,
    address: {
      addressLine1: undefined,
      addressLine2: undefined,
      addressLine3: undefined,
      district: undefined,
      region: undefined,
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
    try {
      const snap = await getDocs(
        query(collection(db, 'Students', abbr, sub), orderBy('timestamp', 'desc'), limit(1)),
      )
      return snap.empty ? null : snap.docs[0].data()
    } catch (e) {
      console.error(`load ${sub} failed`, e)
      return { __error: true }
    }
  }

  useEffect(() => {
    console.log('PersonalTab effect: load latest fields for', abbr)
    let cancelled = false
    ;(async () => {
      const basicFields = ['firstName', 'lastName', 'sex', 'birthDate']
      await Promise.all(
        basicFields.map(async (f) => {
          try {
            const data: any = await loadLatest(f)
            if (cancelled) return
            const val = data?.__error ? '__ERROR__' : data ? data[f] : undefined
            setFields((p: any) => ({ ...p, [f]: val }))
            setLoading((l: any) => {
              const next = { ...l, [f]: false }
              console.log('Loading flags now:', next)
              return next
            })
            onPersonal?.({ [f]: val === '__ERROR__' ? undefined : val })
          } catch (e) {
            console.error(`basic field ${f} load failed`, e)
            setFields((p: any) => ({ ...p, [f]: '__ERROR__' }))
            setLoading((l: any) => {
              const next = { ...l, [f]: false }
              console.log('Loading flags now:', next)
              return next
            })
            onPersonal?.({ [f]: undefined })
          }
        }),
      )

      try {
        const hkidData: any = await loadLatest('HKID')
        if (!cancelled) {
          const val = hkidData?.__error ? '__ERROR__' : hkidData?.idNumber
          setFields((p: any) => ({ ...p, hkid: val }))
        }
      } catch (e) {
        console.error('HKID load failed', e)
        if (!cancelled) setFields((p: any) => ({ ...p, hkid: '__ERROR__' }))
      } finally {
        if (!cancelled)
          setLoading((l: any) => {
            const next = { ...l, hkid: false }
            console.log('Loading flags now:', next)
            return next
          })
      }

      try {
        const phoneData: any = await loadLatest('contactNumber')
        if (!cancelled) {
          const val = phoneData?.__error
            ? { countryCode: '__ERROR__', phoneNumber: '__ERROR__' }
            : {
                countryCode: phoneData?.countryCode,
                phoneNumber: phoneData?.phoneNumber,
              }
          setFields((p: any) => ({ ...p, contactNumber: val }))
        }
      } catch (e) {
        console.error('contact number load failed', e)
        if (!cancelled)
          setFields((p: any) => ({
            ...p,
            contactNumber: { countryCode: '__ERROR__', phoneNumber: '__ERROR__' },
          }))
      } finally {
        if (!cancelled)
          setLoading((l: any) => {
            const next = { ...l, contactNumber: false }
            console.log('Loading flags now:', next)
            return next
          })
      }

      try {
        const emailData: any = await loadLatest('emailAddress')
        if (!cancelled) {
          const val = emailData?.__error ? '__ERROR__' : emailData?.emailAddress
          setFields((p: any) => ({ ...p, emailAddress: val }))
        }
      } catch (e) {
        console.error('email load failed', e)
        if (!cancelled) setFields((p: any) => ({ ...p, emailAddress: '__ERROR__' }))
      } finally {
        if (!cancelled)
          setLoading((l: any) => {
            const next = { ...l, emailAddress: false }
            console.log('Loading flags now:', next)
            return next
          })
      }

      try {
        const addrData: any = await loadLatest('Address')
        if (!cancelled) {
          const val = addrData?.__error
            ? {
                addressLine1: '__ERROR__',
                addressLine2: '__ERROR__',
                addressLine3: '__ERROR__',
                district: '__ERROR__',
                region: '__ERROR__',
              }
            : {
                addressLine1: addrData?.addressLine1,
                addressLine2: addrData?.addressLine2,
                addressLine3: addrData?.addressLine3,
                district: addrData?.district,
                region: addrData?.region,
              }
          setFields((p: any) => ({ ...p, address: val }))
        }
      } catch (e) {
        console.error('address load failed', e)
        if (!cancelled)
          setFields((p: any) => ({
            ...p,
            address: {
              addressLine1: '__ERROR__',
              addressLine2: '__ERROR__',
              addressLine3: '__ERROR__',
              district: '__ERROR__',
              region: '__ERROR__',
            },
          }))
      } finally {
        if (!cancelled)
          setLoading((l: any) => {
            const next = { ...l, address: false }
            console.log('Loading flags now:', next)
            return next
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, onPersonal])

  const age = (() => {
    if (!fields.birthDate || fields.birthDate === '__ERROR__') return ''
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
    console.log('PersonalTab effect: populate edit drafts for', abbr)
    if (editingPhone)
      setPhoneDraft({
        countryCode:
          fields.contactNumber.countryCode &&
          fields.contactNumber.countryCode !== '__ERROR__'
            ? fields.contactNumber.countryCode
            : '',
        phoneNumber:
          fields.contactNumber.phoneNumber &&
          fields.contactNumber.phoneNumber !== '__ERROR__'
            ? fields.contactNumber.phoneNumber
            : '',
      })
    if (editingEmail)
      setEmailDraft(
        fields.emailAddress && fields.emailAddress !== '__ERROR__'
          ? fields.emailAddress
          : '',
      )
    if (editingAddr)
      setAddrDraft({
        addressLine1:
          fields.address.addressLine1 && fields.address.addressLine1 !== '__ERROR__'
            ? fields.address.addressLine1
            : '',
        addressLine2:
          fields.address.addressLine2 && fields.address.addressLine2 !== '__ERROR__'
            ? fields.address.addressLine2
            : '',
        addressLine3:
          fields.address.addressLine3 && fields.address.addressLine3 !== '__ERROR__'
            ? fields.address.addressLine3
            : '',
        district:
          fields.address.district && fields.address.district !== '__ERROR__'
            ? fields.address.district
            : '',
        region:
          fields.address.region && fields.address.region !== '__ERROR__'
            ? fields.address.region
            : '',
      })
    if (editingHKID)
      setHkidDraft(fields.hkid && fields.hkid !== '__ERROR__' ? fields.hkid : '')
  }, [editingPhone, editingEmail, editingAddr, editingHKID])

  const displayField = (v: any) => {
    if (v === '__ERROR__') return 'Error'
    if (v === undefined || v === null || v === '') return 'N/A'
    return String(v)
  }

  return (
    <Box style={style} sx={{ textAlign: 'left', maxWidth: '100%', maxHeight: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Personal Information
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 260px)',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ width: 260 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
          >
            First Name:
          </Typography>
          {loading.firstName ? (
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              Loading…
            </Typography>
          ) : (
            <InlineEdit
              value={fields.firstName}
              fieldPath={`Students/${abbr}/firstName`}
              fieldKey="firstName"
              editable
              serviceMode={serviceMode}
              type="text"
              onSaved={(v) => {
                setFields((p: any) => ({ ...p, firstName: v }))
                onPersonal?.({ firstName: v })
              }}
            />
          )}
        </Box>
        <Box sx={{ width: 260 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
          >
            Last Name:
          </Typography>
          {loading.lastName ? (
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              Loading…
            </Typography>
          ) : (
            <InlineEdit
              value={fields.lastName}
              fieldPath={`Students/${abbr}/lastName`}
              fieldKey="lastName"
              editable
              serviceMode={serviceMode}
              type="text"
              onSaved={(v) => {
                setFields((p: any) => ({ ...p, lastName: v }))
                onPersonal?.({ lastName: v })
              }}
            />
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 160px)',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ width: 160 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
          >
            Gender:
          </Typography>
          {loading.sex ? (
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              Loading…
            </Typography>
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
        <Box sx={{ width: 160 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
          >
            Age:
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            {age || '–'}
          </Typography>
        </Box>
        <Box sx={{ width: 200 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
          >
            Birth Date:
          </Typography>
          {loading.birthDate ? (
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              Loading…
            </Typography>
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
      </Box>

      <Box mb={2} sx={{ width: 260 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          ID No.:
        </Typography>
        {loading.hkid ? (
          <Typography
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            Loading…
          </Typography>
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
            sx={{ cursor: 'pointer', fontFamily: 'Newsreader', fontWeight: 500 }}
            onClick={() => setEditingHKID(true)}
          >
            {displayField(fields.hkid)}
          </Typography>
        )}
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Contact Information
      </Typography>

      {/* Contact Number */}
      <Box mb={2} sx={{ width: 260 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Contact Number:
        </Typography>
        {loading.contactNumber ? (
          <Typography
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            Loading…
          </Typography>
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
            sx={{ cursor: 'pointer', fontFamily: 'Newsreader', fontWeight: 500 }}
            onClick={() => setEditingPhone(true)}
          >
            {fields.contactNumber.countryCode === undefined &&
            fields.contactNumber.phoneNumber === undefined
              ? 'N/A'
              : `+${displayField(fields.contactNumber.countryCode)} ${displayField(
                  fields.contactNumber.phoneNumber,
                )}`}
          </Typography>
        )}
      </Box>

      {/* Email Address */}
      <Box mb={2} sx={{ width: 260 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Email Address:
        </Typography>
        {loading.emailAddress ? (
          <Typography
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            Loading…
          </Typography>
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
            sx={{ cursor: 'pointer', fontFamily: 'Newsreader', fontWeight: 500 }}
            onClick={() => setEditingEmail(true)}
          >
            {displayField(fields.emailAddress)}
          </Typography>
        )}
      </Box>

      {/* Contact Address */}
      <Box mb={2} sx={{ width: 260 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Contact Address:
        </Typography>
        {loading.address ? (
          <Typography
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            Loading…
          </Typography>
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
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {displayField(fields.address.addressLine1)}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {displayField(fields.address.addressLine2)}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {displayField(fields.address.addressLine3)}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {displayField(fields.address.district)}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {displayField(fields.address.region)}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

