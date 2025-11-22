import { Buffer } from 'buffer'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import { amountHK, num2eng, num2chi } from '../invoiceFormat'
import { FONT_DATA } from './fontData'

// Remote TTF fallbacks (used only if embedded base64 is missing)
const REMOTE_TTF = {
  RobotoMonoRegular: 'https://raw.githubusercontent.com/google/fonts/main/apache/robotomono/RobotoMono-Regular.ttf',
  RobotoMonoBold: 'https://raw.githubusercontent.com/google/fonts/main/apache/robotomono/RobotoMono-Bold.ttf',
  RobotoMonoVar: 'https://raw.githubusercontent.com/google/fonts/main/ofl/robotomono/RobotoMono%5Bwght%5D.ttf',
  VarelaRoundRegular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/varelaround/VarelaRound-Regular.ttf',
  RampartOneRegular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/rampartone/RampartOne-Regular.ttf',
  CormorantInfantVar: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantinfant/CormorantInfant%5Bwght%5D.ttf',
  NanumPenScriptRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/nanum-pen-script@5.0.8/files/nanum-pen-script-latin-400-normal.woff',
  YomogiRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/yomogi@5.0.8/files/yomogi-latin-400-normal.woff',
  EphesisRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/ephesis@5.0.8/files/ephesis-latin-400-normal.woff',
  EBGaramondRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/eb-garamond@5.0.8/files/eb-garamond-latin-400-normal.woff',
} as const

const ensureAtobPolyfill = () => {
  if (typeof globalThis.atob !== 'function') {
    globalThis.atob = (input: string) => Buffer.from(input, 'base64').toString('binary')
  }
}

const toDataUri = (base64?: string | null) => (base64 ? `data:font/ttf;base64,${base64}` : null)

const isValidBase64Font = (b64?: string | null) => {
  try {
    if (!b64 || typeof b64 !== 'string' || b64.length < 32) return false
    const buf = Buffer.from(b64, 'base64')
    if (!buf || buf.length < 1024) return false
    // TrueType starts with 00 01 00 00; OpenType(CFF) starts with 'OTTO'
    const sig = buf.slice(0, 4).toString('ascii')
    if (sig === 'OTTO') return true
    const ttfSig = buf.readUInt32BE(0)
    return ttfSig === 0x00010000
  } catch {
    return false
  }
}

const pickFontSrc = (fileKey: keyof typeof FONT_DATA | string, remoteUrl?: string | null) => {
  try {
    // Prefer embedded base64 when available
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const base64: string | undefined = FONT_DATA[fileKey as any]
    if (isValidBase64Font(base64)) {
      const data = toDataUri(base64)
      if (data) {
        try { console.info('[pdf-font] using embedded', { fileKey }) } catch {}
        return data
      }
    }
    if (remoteUrl) {
      try { console.info('[pdf-font] using remote', { fileKey, url: remoteUrl }) } catch {}
      return remoteUrl
    }
  } catch (err) {
    try { console.error('[pdf-font] pickFontSrc error', { fileKey, error: (err as any)?.message || String(err) }) } catch {}
  }
  return null
}

const registerFontFamily = () => {
  ensureAtobPolyfill()
  try {
    // RobotoMono: prefer embedded; fallback to variable TTF URL when not embedded
    const r400 = pickFontSrc('RobotoMono-Regular.ttf', REMOTE_TTF.RobotoMonoVar)
    const r700 = pickFontSrc('RobotoMono-Bold.ttf', REMOTE_TTF.RobotoMonoVar)
    if (!r400 || !r700) {
      try { console.error('[pdf-font] RobotoMono sources missing', { has400: Boolean(r400), has700: Boolean(r700) }) } catch {}
    }
    if (r400 && r700) {
      Font.register({
        family: 'RobotoMono',
        fonts: [
          { src: r400, fontWeight: 400 },
          { src: r700, fontWeight: 700 },
        ],
      })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register RobotoMono', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const varela = pickFontSrc('VarelaRound-Regular.ttf', REMOTE_TTF.VarelaRoundRegular)
    if (!varela) {
      try { console.error('[pdf-font] VarelaRound source missing') } catch {}
    } else {
      Font.register({ family: 'VarelaRound', src: varela })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register VarelaRound', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const ciVar = REMOTE_TTF.CormorantInfantVar
    Font.register({
      family: 'CormorantInfant',
      fonts: [
        { src: ciVar, fontWeight: 400 },
        { src: ciVar, fontWeight: 700 },
      ],
    })
  } catch (error) {
    try { console.error('[pdf-font] failed to register CormorantInfant', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const rampart = pickFontSrc('RampartOne-Regular.ttf', REMOTE_TTF.RampartOneRegular)
    if (!rampart) {
      try { console.error('[pdf-font] RampartOne source missing') } catch {}
    } else {
      Font.register({ family: 'RampartOne', src: rampart })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register RampartOne', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const iansuiBase64 = FONT_DATA['Iansui-Regular.ttf']
    const iansui = toDataUri(iansuiBase64)
    if (!iansui) {
      try { console.error('[pdf-font] Iansui embedded data missing') } catch {}
    } else {
      Font.register({ family: 'Iansui', src: iansui })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register Iansui', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    // Google Sans Mono - CDN from Reddit thread (example TTF URL, usually dynamic CSS)
    // This font often requires a CSS @import or direct TTF links. For simplicity, we'll use
    // a generic Google Fonts CDN and register with a fallback.
    Font.register({
      family: 'Google Sans Mono',
      src: 'https://fonts.googleapis.com/css2?family=Google+Sans+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap',
      // React-PDF expects a direct TTF/WOFF URL, not a CSS link. This will likely fail.
      // Fallback to a generic sans-serif in StyleSheet.
    });
  } catch (error) {
    try { console.error('[pdf-font] failed to register Google Sans Mono', { error: (error as any)?.message || String(error) }) } catch {}
  }

  try {
    // Nanum Pen Script
    const nanum = REMOTE_TTF.NanumPenScriptRegular;
    if (nanum) {
      Font.register({ family: 'Nanum Pen Script', src: nanum });
    } else {
      try { console.error('[pdf-font] Nanum Pen Script source missing') } catch {}
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register Nanum Pen Script', { error: (error as any)?.message || String(error) }) } catch {}
  }

  try {
    // Yomogi
    const yomogi = REMOTE_TTF.YomogiRegular;
    if (yomogi) {
      Font.register({ family: 'Yomogi', src: yomogi });
    } else {
      try { console.error('[pdf-font] Yomogi source missing') } catch {}
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register Yomogi', { error: (error as any)?.message || String(error) }) } catch {}
  }

  try {
    // Ephesis
    const ephesis = REMOTE_TTF.EphesisRegular;
    if (ephesis) {
      Font.register({ family: 'Ephesis', src: ephesis });
    } else {
      try { console.error('[pdf-font] Ephesis source missing') } catch {}
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register Ephesis', { error: (error as any)?.message || String(error) }) } catch {}
  }

  try {
    // EB Garamond
    const ebGaramond = REMOTE_TTF.EBGaramondRegular;
    if (ebGaramond) {
      Font.register({ family: 'EB Garamond', src: ebGaramond });
    } else {
      try { console.error('[pdf-font] EB Garamond source missing') } catch {}
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register EB Garamond', { error: (error as any)?.message || String(error) }) } catch {}
  }

  // Removed Karla WOFF registration (unsupported format in fontkit/React-PDF). If Karla is
  // required later, embed a TTF as base64 in FONT_DATA or use a valid TTF URL.
}

registerFontFamily()

const PAGE_WIDTH = 595.28 // A4 width in points
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = { top: 21.6, bottom: 21.6, left: 14.4, right: 14.4 } // 0.3"/0.2"
const px2pt = (px: number) => px * 0.75
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN.left - PAGE_MARGIN.right
// Use absolute widths (pt) for closer parity; replace with scanned values when available
const DESC_COL_WIDTH = Math.round(CONTENT_WIDTH * 0.70)
const AMOUNT_COL_WIDTH = Math.max(0, Math.round(CONTENT_WIDTH - DESC_COL_WIDTH))

import { generatedStyles as styles } from './generatedStyles';

export type ClassicInvoiceItem = {
  title?: string | null
  subQuantity?: string | null
  feeType?: string | null
  notes?: string | null
  unitPrice?: number | null
  quantity?: number | null
  quantityUnit?: string | null
  discount?: number | null
}

export interface ClassicInvoiceDocInput {
  invoiceNumber: string
  invoiceDateDisplay?: string | null
  projectNumber?: string | null
  projectDate?: string | null
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: string | null
  presenterWorkType?: string | null
  projectTitle?: string | null
  projectNature?: string | null
  projectPickupDate?: string | null
  subsidiaryEnglishName?: string | null
  subsidiaryChineseName?: string | null
  subsidiaryAddressLines?: string[]
  subsidiaryPhone?: string | null
  subsidiaryEmail?: string | null
  items: ClassicInvoiceItem[]
  subtotal?: number | null
  total?: number | null
  amount?: number | null
  taxOrDiscountPercent?: number | null
  paidTo?: string | null
  paymentStatus?: string | null
  bankName?: string | null
  bankCode?: string | null
  accountType?: string | null
  bankAccountNumber?: string | null
  fpsId?: string | null
  fpsEmail?: string | null
  paymentTerms?: string | null
}

export type ClassicInvoiceVariant = 'bundle' | 'A' | 'A2' | 'B' | 'B2'

type VariantBase = 'A' | 'B'

const LINE_LIMITS: Record<VariantBase, { first: number; other: number }> = {
  B: { first: 32, other: 38 },
  A: { first: 34, other: 42 },
}

const estimateItemLines = (item: ClassicInvoiceItem) => {
  let lines = 3
  if (item.subQuantity) lines += 1
  if (item.feeType) lines += 1
  if (item.notes) {
    const text = String(item.notes)
    const chunks = Math.max(1, Math.ceil(text.length / 80))
    lines += chunks
  }
  return lines
}

const paginateItemsForVariant = (items: ClassicInvoiceItem[], variant: VariantBase) => {
  const limits = LINE_LIMITS[variant]
  const pages: ClassicInvoiceItem[][] = []
  let current: ClassicInvoiceItem[] = []
  let remaining = limits.first
  const otherLimit = limits.other
  const pushPage = () => {
    if (current.length) {
      pages.push(current)
      current = []
    }
  }
  items.forEach((item, index) => {
    const lines = estimateItemLines(item)
    const limit = pages.length === 0 ? limits.first : otherLimit
    if (current.length === 0 && lines > limit) {
      pages.push([item])
      remaining = otherLimit
      return
    }
    if (lines > remaining) {
      pushPage()
      remaining = otherLimit
    }
    current.push(item)
    remaining -= lines
  })
  if (current.length) {
    pages.push(current)
  }
  if (!pages.length) {
    pages.push([])
  }
  return pages
}

const joinAddress = (parts: (string | null | undefined)[]) =>
  parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(', ')

const renderAddressLines = (lines: (string | null | undefined)[]) =>
  lines
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line, idx) => (
      <Text key={`addr-${idx}`} style={{ fontSize: 10 }}>
        {line}
      </Text>
    ))

const BillTo = ({ data }: { data: ClassicInvoiceDocInput }) => {
  const addressLines = [
    data.addressLine1,
    data.addressLine2,
    joinAddress([data.addressLine3, data.region]),
  ].filter((line): line is string => Boolean(line && line.trim()))
  return (
    <View style={{ flex: 1, paddingRight: 18 }}>
      <Text style={styles.sectionLabel}>BILL TO:</Text>
      <Text style={styles.billName}>{data.companyName ?? '-'}</Text>
      {addressLines.map((line, idx) => (
        <Text key={`client-line-${idx}`}>{line}</Text>
      ))}
      {data.representative ? (
        <Text style={{ fontWeight: 700, marginTop: 4 }}>ATTN: {data.representative}</Text>
      ) : null}
    </View>
  )
}

const ProjectMeta = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <View style={{ marginBottom: 12 }}>
    {data.presenterWorkType ? (
      <Text style={{ fontFamily: 'Google Sans Mono', fontSize: 8, fontStyle: 'italic' }}>
        {data.presenterWorkType}
      </Text>
    ) : null}
    {data.projectTitle ? (
      <Text style={styles.projectTitle}>{data.projectTitle}</Text>
    ) : null}
    {data.projectNature ? (
      <Text style={styles.projectNature}>{data.projectNature}</Text>
    ) : null}
  </View>
)

const ItemsTable = ({ data, items }: { data: ClassicInvoiceDocInput; items: ClassicInvoiceItem[] }) => (
  <View>
      <View style={styles.tableHeader}>
        <View style={styles.tableColDesc}>
          <Text style={{ fontWeight: 700, letterSpacing: 0.8 }}>Description</Text>
        </View>
        <View style={styles.tableColAmount}>
          <Text style={{ fontWeight: 700, letterSpacing: 0.8 }}>Amount</Text>
        </View>
      </View>
    {items.length === 0 ? (
      <View style={{ paddingVertical: 12 }}>
        <Text>No items added.</Text>
      </View>
    ) : (
      items.map((item, idx) => {
        const total = (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discount ?? 0)
        return (
          <View key={`item-${idx}`} style={styles.itemRow}>
            <View style={styles.tableColDesc}>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>{item.title || `Item ${idx + 1}`}</Text>
              {item.subQuantity ? <Text>{item.subQuantity}</Text> : null}
              {item.feeType ? <Text style={{ fontStyle: 'italic' }}>{item.feeType}</Text> : null}
              {item.notes ? <Text>{item.notes}</Text> : null}
              <Text style={{ fontStyle: 'italic', color: '#6b7280', marginTop: 2 }}>
                {amountHK(item.unitPrice ?? 0)} × {item.quantity ?? 0}
                {item.quantityUnit ? ` ${item.quantityUnit}` : ''}
                {item.discount ? ` — Disc ${amountHK(item.discount)}` : ''}
              </Text>
            </View>
            <View style={styles.tableColAmount}>
              <Text style={styles.amountCell}>{amountHK(total)}</Text>
            </View>
          </View>
        )
      })
    )}
  </View>
)

const computeTotals = (data: ClassicInvoiceDocInput) => {
  const subtotal =
    typeof data.subtotal === 'number'
      ? data.subtotal
      : data.items.reduce((sum, item) => sum + Math.max(0, (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discount ?? 0)), 0)
  const total =
    typeof data.total === 'number'
      ? data.total
      : typeof data.amount === 'number'
        ? data.amount
        : subtotal
  const adjustment = total - subtotal
  return { subtotal, total, adjustment }
}

const Totals = ({ data }: { data: ClassicInvoiceDocInput }) => {
  const { subtotal, total, adjustment } = computeTotals(data)
  const hasAdjustment = Math.abs(adjustment) >= 0.01
  return (
    <View style={styles.totalsBlock}>
      <View style={styles.totalsRow}>
        <Text>Subtotal</Text>
        <Text>{amountHK(subtotal)}</Text>
      </View>
      {hasAdjustment ? (
        <View style={styles.totalsRow}>
          <Text>Adjustment</Text>
          <Text>{amountHK(adjustment)}</Text>
        </View>
      ) : null}
      <View style={[styles.totalsRow, { marginTop: 6 }]}>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>Invoice Total</Text>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>{amountHK(total)}</Text>
      </View>
      <View style={{ marginTop: 8 }}>
        <Text>For the amount of: {num2eng(total) || amountHK(total)}</Text>
        <Text style={{ fontFamily: 'Iansui' }}>茲付金額：{num2chi(total)}</Text>
      </View>
    </View>
  )
}

// Removed generic PaymentSummary from item pages. All payment identifiers and terms are
// rendered only on the Payment Details/Instructions pages to match the classic invoices.

const FooterBlock = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <View style={styles.footer}>
    <Text>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
    {data.subsidiaryChineseName ? <Text style={styles.footerZh}>{data.subsidiaryChineseName}</Text> : null}
    {renderAddressLines(data.subsidiaryAddressLines ?? [])}
    {data.subsidiaryPhone ? <Text>{data.subsidiaryPhone}</Text> : null}
    {data.subsidiaryEmail ? <Text>{data.subsidiaryEmail}</Text> : null}
  </View>
)

type ItemPageDescriptor = {
  kind: 'items'
  variantBase: VariantBase
  items: ClassicInvoiceItem[]
  pageIndex: number
  totalPagesForVariant: number
}

type ExtraPageDescriptor =
  | { kind: 'payment-details'; title: 'Payment Details' }
  | { kind: 'payment-instructions'; title: 'Payment Instructions' }

type PageDescriptor = ItemPageDescriptor | ExtraPageDescriptor

const buildHKFPSPayload = (
  fpsProxyValue: string | null,
  includeAmount: boolean,
  amountNumber: number | null,
) => {
  if (!fpsProxyValue || !fpsProxyValue.trim()) return null
  const TLV = (id: string, val: string | null | undefined) => {
    if (!val) return ''
    const str = String(val)
    return id + (`0${str.length}`).slice(-2) + str
  }

  const CRC16 = (input: string) => {
    let crc = 0xffff
    for (let i = 0; i < input.length; i++) {
      crc ^= (input.charCodeAt(i) & 0xff) << 8
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
        else crc <<= 1
        crc &= 0xffff
      }
    }
    return (`000${crc.toString(16).toUpperCase()}`).slice(-4)
  }

  const payloadFormat = TLV('00', '01')
  const pointOfInit = TLV('01', includeAmount ? '12' : '11')
  const raw = fpsProxyValue.trim()
  let proxyType: 'id' | 'phone' | 'email'
  if (/@/.test(raw)) proxyType = 'email'
  else if (/^\+/.test(raw)) proxyType = 'phone'
  else proxyType = 'id'
  const GUID = 'hk.com.hkicl'
  let mai = TLV('00', GUID)
  if (proxyType === 'email') mai += TLV('04', raw)
  else if (proxyType === 'phone') mai += TLV('03', raw)
  else mai += TLV('02', raw)
  const merchantAccountInfo = TLV('26', mai)
  const mcc = TLV('52', '0000')
  const currency = TLV('53', '344')
  let amountTLV = ''
  if (includeAmount && typeof amountNumber === 'number' && Number.isFinite(amountNumber)) {
    let amt = amountNumber.toFixed(2).replace(/\.00$/, '')
    amountTLV = TLV('54', amt)
  }
  const country = TLV('58', 'HK')
  const name = TLV('59', 'NA')
  const city = TLV('60', 'HK')
  const withoutCRC = payloadFormat + pointOfInit + merchantAccountInfo + mcc + currency + amountTLV + country + name + city
  const crc = CRC16(withoutCRC + '63' + '04')
  return withoutCRC + '63' + '04' + crc
}

const buildHKFPSQrUrl = (payload: string | null, size = 220) =>
  payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`
    : null

const PaymentDetailsPage = ({
  data,
  qrPayload,
  pageNumber,
  totalPages,
}: {
  data: ClassicInvoiceDocInput
  qrPayload: string | null
  pageNumber: number
  totalPages: number
}) => {
  const qrUrl = buildHKFPSQrUrl(qrPayload, 240)
  return (
    <Page size="A4" style={styles.page}>
      <Text style={{ fontFamily: 'CormorantInfant', fontSize: 22, letterSpacing: 0.3, marginBottom: 12 }}>
        Payment Details
      </Text>

      {/* Beneficiary / Bank identifiers */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
          Beneficiary: <Text style={{ fontWeight: 700 }}>{data.paidTo ?? data.subsidiaryEnglishName ?? '-'}</Text>
        </Text>
        {(data as any).brNo ? (
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>BR No.: {(data as any).brNo}</Text>
        ) : null}
        {data.bankName ? (
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
            Bank: {data.bankName}{data.bankCode ? ` (${data.bankCode})` : ''}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 2 }}>
          {data.bankCode ? (
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>Branch Code: {data.bankCode}</Text>
          ) : null}
          {data.bankAccountNumber ? (
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>Account Number: {data.bankAccountNumber}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
          {data.fpsId ? (
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>FPS ID: {data.fpsId}</Text>
          ) : null}
          {qrUrl ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image src={qrUrl} style={{ width: 120, height: 120 }} />
              <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>FPS QR Code</Text>
            </View>
          ) : null}
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
            For the amount of: <Text style={{ fontWeight: 700 }}>{num2eng((typeof data.total === 'number' ? data.total : data.amount) ?? 0) || amountHK((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
          </Text>
          <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>茲付金額：{num2chi((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>Address:</Text>
          {renderAddressLines(data.subsidiaryAddressLines ?? [])}
        </View>
      </View>

      {/* Terms & Conditions */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: 'CormorantInfant', fontSize: 16, marginBottom: 6 }}>Terms & Conditions</Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          1. Acceptance: By continuing to use our services, instructing us to proceed, requesting release of deliverables, failing to object in writing within the dispute period, or paying in whole or in part, the Client is deemed to have agreed to and be bound by these Terms & Conditions.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          2. Payment: Payment is due within seven (7) calendar days after the earlier of (i) the Invoice date; or (ii) the Client’s written request to release final deliverables. Deliverables are released only after receipt of cleared funds.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          3. Disputes: Any billing disputes must be submitted in writing within three (3) days of receipt of this Invoice; otherwise, the Invoice is deemed accepted.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          4. Late Charges: If payment is not received when due, a late fee of the greater of HK$150 or 1.5% of the outstanding balance per 14-day period accrues until paid in full, unless otherwise agreed in writing.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          5. Other terms customary to your invoices can be added verbatim here.
        </Text>
      </View>

      <FooterBlock data={data} />
      <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
    </Page>
  )
}

const PaymentInstructionsPage = ({
  data,
  qrPayload,
  pageNumber,
  totalPages,
}: {
  data: ClassicInvoiceDocInput
  qrPayload: string | null
  pageNumber: number
  totalPages: number
}) => (
  <Page size="A4" style={styles.page}>
    <Text style={{ fontFamily: 'CormorantInfant', fontSize: 22, letterSpacing: 0.3, marginBottom: 10 }}>
      Payment Instructions
    </Text>
      <Text style={{ fontSize: 10, marginBottom: 12 }}>
      Payment for this invoice is required within <Text style={{ fontWeight: 700 }}>7 DAYS</Text> of its issuance. Please choose from the payment methods listed below.
    </Text>

    {/* 1. Payable Cheque */}
    <View style={{ borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fff7e6', borderRadius: 6, padding: 16, marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>1. Payable Cheque</Text>
      <View style={{ borderWidth: 1, borderColor: '#eab308', backgroundColor: '#fffef7', borderRadius: 4, padding: 12 }}>
        <Text style={{ fontSize: 10 }}>
          Pay to: {data.paidTo ?? data.subsidiaryEnglishName ?? 'Establish Records Limited'}
        </Text>
        <Text style={{ fontSize: 10 }}>Amount (in words): {num2eng((typeof data.total === 'number' ? data.total : data.amount) ?? 0) || amountHK((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
        <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>金額（中文）：{num2chi((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
      </View>
    </View>

    <Text style={{ fontSize: 10, textAlign: 'center', marginBottom: 12 }}>or</Text>

    {/* 2. Payment Transfer */}
    <View style={{ borderWidth: 1, borderColor: '#86efac', backgroundColor: '#f0fff4', borderRadius: 6, padding: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>2. Payment Transfer</Text>
      <Text style={{ fontSize: 10 }}>Account Name: {data.paidTo ?? data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
      {data.bankName ? (
        <Text style={{ fontSize: 10 }}>
          Bank: {data.bankName}{data.bankCode ? ` (${data.bankCode})` : ''}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 2 }}>
        {data.bankCode ? <Text style={{ fontSize: 10 }}>Branch Code: {data.bankCode}</Text> : null}
        {data.bankAccountNumber ? <Text style={{ fontSize: 10 }}>Account Number: {data.bankAccountNumber}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
        {data.fpsId ? <Text style={{ fontSize: 10 }}>FPS ID: {data.fpsId}</Text> : null}
        {qrPayload ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image src={buildHKFPSQrUrl(qrPayload, 128)!} style={{ width: 96, height: 96 }} />
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
              ↑ SCAN IN BANK APP
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
          For the amount of: <Text style={{ fontWeight: 700 }}>{num2eng((typeof data.total === 'number' ? data.total : data.amount) ?? 0) || amountHK((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
        </Text>
        <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>茲付金額：{num2chi((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
      </View>
    </View>

    <FooterBlock data={data} />
    <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
  </Page>
)

const renderHeaderForVariant = (
  data: ClassicInvoiceDocInput,
  variant: VariantBase,
  showClientBlock: boolean,
) => {
  if (variant === 'A') {
    return (
      <>
        <View style={[styles.headerRow, { marginBottom: 16 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.invoiceLabel}>Invoice</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Invoice #: {data.invoiceNumber}</Text>
            {data.invoiceDateDisplay ? <Text style={{ fontSize: 10 }}>Date: {data.invoiceDateDisplay}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', paddingLeft: 12 }}>
            <Text style={[styles.logoMark, { marginBottom: 6 }]}>E.</Text>
            <Text style={{ fontSize: 10, fontWeight: 700 }}>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
            {data.subsidiaryChineseName ? <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>{data.subsidiaryChineseName}</Text> : null}
            <View style={{ marginTop: 2 }}>{renderAddressLines(data.subsidiaryAddressLines ?? [])}</View>
          </View>
        </View>
        {showClientBlock ? (
          <View style={[styles.headerRow, { marginBottom: 8 }]}>
            <BillTo data={data} />
            <View style={{ width: 220 }} />
          </View>
        ) : null}
      </>
    )
  }

  return (
    <>
      <View style={[styles.headerRow, { marginBottom: 16 }]}>
        <View>
          <Text style={[styles.logoMark, { marginRight: 8 }]}>E.</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10, fontWeight: 700 }}>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
          {data.subsidiaryChineseName ? <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>{data.subsidiaryChineseName}</Text> : null}
          {renderAddressLines(data.subsidiaryAddressLines ?? [])}
          {data.subsidiaryEmail ? <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>{data.subsidiaryEmail}</Text> : null}
          {data.subsidiaryPhone ? <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>{data.subsidiaryPhone}</Text> : null}
        </View>
      </View>
      {showClientBlock ? (
        <View style={styles.headerRow}>
          <BillTo data={data} />
          <View style={{ width: 200, borderLeftWidth: 1, borderColor: '#cbd5f5', paddingLeft: 16 }}>
            <Text style={styles.sectionLabel}>Invoice</Text>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>Invoice #: {data.invoiceNumber}</Text>
            {data.invoiceDateDisplay ? <Text>Date: {data.invoiceDateDisplay}</Text> : null}
            <ProjectMeta data={data} />
          </View>
        </View>
      ) : null}
    </>
  )
}

const renderFooterForVariant = (
  data: ClassicInvoiceDocInput,
  variant: VariantBase,
  showFooter: boolean,
  pageNumber: number,
  totalPages: number,
) => (
  <>
    {showFooter ? <FooterBlock data={data} /> : null}
    <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
  </>
)

const renderItemPage = (
  data: ClassicInvoiceDocInput,
  descriptor: ItemPageDescriptor,
  pageNumber: number,
  totalPages: number,
  includeTotals: boolean,
  showFooter: boolean,
) => (
  <Page key={`items-${descriptor.variantBase}-${descriptor.pageIndex}-${pageNumber}`} size="A4" style={styles.page}>
    {renderHeaderForVariant(data, descriptor.variantBase, descriptor.pageIndex === 0)}
    <ItemsTable data={data} items={descriptor.items} />
    {includeTotals ? <Totals data={data} /> : null}
    {renderFooterForVariant(data, descriptor.variantBase, showFooter, pageNumber, totalPages)}
  </Page>
)

const buildDescriptors = (variant: ClassicInvoiceVariant, data: ClassicInvoiceDocInput): PageDescriptor[] => {
  const descriptors: PageDescriptor[] = []
  const addVariantBlock = (base: VariantBase, includePaymentDetails: boolean, includePaymentInstructions: boolean) => {
    const paginated = paginateItemsForVariant(data.items, base)
    paginated.forEach((items, pageIndex) => {
      descriptors.push({
        kind: 'items',
        variantBase: base,
        items,
        pageIndex,
        totalPagesForVariant: paginated.length,
      })
    })
    if (includePaymentDetails) descriptors.push({ kind: 'payment-details', title: 'Payment Details' })
    if (includePaymentInstructions) descriptors.push({ kind: 'payment-instructions', title: 'Payment Instructions' })
  }

  switch (variant) {
    case 'B':
      addVariantBlock('B', false, false)
      break
    case 'B2':
      addVariantBlock('B', false, true)
      break
    case 'A':
      addVariantBlock('A', true, false)
      break
    case 'A2':
      addVariantBlock('A', true, true)
      break
    case 'bundle':
    default:
      // Produce exactly 4 pages to mirror company standard:
      // 1) Invoice (variant B), 2) Invoice (variant A), 3) Payment Details, 4) Payment Instructions
      addVariantBlock('B', false, false) // Variant B items pages
      addVariantBlock('A', true, true) // Variant A items pages, plus payment details and instructions
      break
  }
  return descriptors
}

import { generatedStyles as styles } from './generatedStyles';

export const buildClassicInvoiceDocument = (
  data: ClassicInvoiceDocInput,
  options?: { variant?: ClassicInvoiceVariant },
) => {
  // For now, we will render the first sheet from the template data.
  // We can add logic to switch between sheets for different variants later.
  const sheetData = require('../../tmp/invoice-template-data.json');
  const { rows, merges, rowMetadata, columnMetadata } = sheetData;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          {rows.map((row: any, rowIndex: number) => (
            <View key={rowIndex} style={{ flexDirection: 'row', height: rowMetadata[rowIndex]?.pixelSize || 'auto' }}>
              {row.map((cell: any, colIndex: number) => {
                const style = styles[`cell_${rowIndex}_${colIndex}`] || {};
                const width = columnMetadata[colIndex]?.pixelSize || 100;

                // Check if this cell is part of a merge
                const merge = merges.find(
                  (m: any) =>
                    rowIndex >= m.startRowIndex &&
                    rowIndex < m.endRowIndex &&
                    colIndex >= m.startColumnIndex &&
                    colIndex < m.endColumnIndex
                );

                if (merge && (rowIndex !== merge.startRowIndex || colIndex !== merge.startColumnIndex)) {
                  // This cell is not the top-left of a merged region, so we render nothing.
                  return null;
                }

                let colSpan = 1;
                let rowSpan = 1;
                if (merge) {
                  colSpan = merge.endColumnIndex - merge.startColumnIndex;
                  rowSpan = merge.endRowIndex - merge.startRowIndex;
                }

                let finalWidth = 0;
                for (let i = 0; i < colSpan; i++) {
                  finalWidth += columnMetadata[colIndex + i]?.pixelSize || 100;
                }
                
                let finalHeight = 0;
                for (let i = 0; i < rowSpan; i++) {
                    finalHeight += rowMetadata[rowIndex + i]?.pixelSize || 21;
                }

                return (
                  <View key={colIndex} style={{ width: finalWidth, height: finalHeight, ...style }}>
                    <Text>{cell?.value || ''}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};
