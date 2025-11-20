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
} as const

const ensureAtobPolyfill = () => {
  if (typeof globalThis.atob !== 'function') {
    globalThis.atob = (input: string) => Buffer.from(input, 'base64').toString('binary')
  }
}

const toDataUri = (base64?: string | null) => (base64 ? `data:font/ttf;base64,${base64}` : null)

const pickFontSrc = (fileKey: keyof typeof FONT_DATA | string, remoteUrl?: string | null) => {
  try {
    // Prefer embedded base64 when available
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const base64: string | undefined = FONT_DATA[fileKey as any]
    const data = toDataUri(base64)
    if (data) {
      try { console.info('[pdf-font] using embedded', { fileKey }) } catch {}
      return data
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
    let r400 = pickFontSrc('RobotoMono-Regular.ttf', REMOTE_TTF.RobotoMonoRegular)
    let r700 = pickFontSrc('RobotoMono-Bold.ttf', REMOTE_TTF.RobotoMonoBold)
    // Fallback to variable TTF if specific cuts are unavailable
    if (!r400) r400 = REMOTE_TTF.RobotoMonoVar
    if (!r700) r700 = REMOTE_TTF.RobotoMonoVar
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

  const styles = StyleSheet.create({
    page: {
    fontFamily: 'Helvetica',
    fontSize: 10, // Body text
    color: '#111827',
    paddingTop: PAGE_MARGIN.top,
    paddingBottom: PAGE_MARGIN.bottom,
    paddingHorizontal: PAGE_MARGIN.left,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logoMark: {
    fontFamily: 'RampartOne',
    fontSize: 36,
    color: '#0f172a',
  },
  invoiceLabel: {
    fontFamily: 'CormorantInfant',
    fontSize: 24,
    letterSpacing: 0.35,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#475569',
    marginBottom: 4,
  },
  billName: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  projectTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 1,
  },
  projectNature: {
    fontStyle: 'italic',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderColor: '#0f172a',
    paddingBottom: 4,
    marginTop: 16,
  },
  tableColDesc: {
    width: DESC_COL_WIDTH,
    paddingRight: 18,
  },
  tableColAmount: {
    width: AMOUNT_COL_WIDTH,
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
  },
  amountCell: {
    fontWeight: 700,
  },
  totalsBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#94a3b8',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  footer: {
    marginTop: 14,
    fontSize: 8.5,
    color: '#475569',
  },
  footerZh: {
    fontFamily: 'Iansui',
    marginTop: 2,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#94a3b8',
  },
  qrContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
})

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
  <View />
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

const PaymentSummary = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <View style={{ marginTop: 12 }}>
    <Text>
      Cheque Payable To: {data.paidTo ?? data.subsidiaryEnglishName ?? 'Establish Records Limited'}
    </Text>
    {data.bankName ? (
      <Text>
        Bank: {data.bankName}
        {data.bankCode ? ` (${data.bankCode})` : ''} {data.accountType ? `– ${data.accountType}` : ''}
      </Text>
    ) : null}
    {data.bankAccountNumber ? <Text>Bank Account Number: {data.bankAccountNumber}</Text> : null}
    {data.fpsId ? <Text>FPS ID: {data.fpsId}</Text> : null}
    {data.fpsEmail ? <Text>FPS Email: {data.fpsEmail}</Text> : null}
    {data.paymentStatus ? (
      <Text style={{ fontStyle: 'italic', color: '#7f1d1d' }}>Status: {data.paymentStatus}</Text>
    ) : null}
    {data.paymentTerms ? <Text style={{ marginTop: 6, fontWeight: 600 }}>Payment Terms: {data.paymentTerms}</Text> : null}
  </View>
)

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
      <Text style={{ fontFamily: 'VarelaRound', fontSize: 20, textAlign: 'center', marginBottom: 16 }}>
        Payment Details
      </Text>
      <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <Text style={styles.sectionLabel}>Payee</Text>
        <Text style={{ fontSize: 12, fontWeight: 700 }}>{data.paidTo ?? data.subsidiaryEnglishName ?? '-'}</Text>
        <Text>{data.subsidiaryEnglishName ?? ''}</Text>
        {renderAddressLines(data.subsidiaryAddressLines ?? [])}
      </View>
      <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 16 }}>
        <Text style={styles.sectionLabel}>Bank Information</Text>
        <Text>Bank: {data.bankName ?? '-'}</Text>
        {data.bankCode ? <Text>Bank Code: {data.bankCode}</Text> : null}
        <Text>Account Type: {data.accountType ?? '-'}</Text>
        <Text>Account Number: {data.bankAccountNumber ?? '-'}</Text>
        {data.fpsId ? <Text>FPS ID: {data.fpsId}</Text> : null}
        {data.fpsEmail ? <Text>FPS Email: {data.fpsEmail}</Text> : null}
        {qrUrl ? (
          <View style={styles.qrContainer}>
            <Image src={qrUrl} style={{ width: 140, height: 140 }} />
            <Text>Scan this QR via FPS to auto-fill payee reference.</Text>
          </View>
        ) : null}
      </View>
      <FooterBlock data={data} />
      <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
    </Page>
  )
}

const PaymentInstructionsPage = ({
  data,
  pageNumber,
  totalPages,
}: {
  data: ClassicInvoiceDocInput
  pageNumber: number
  totalPages: number
}) => (
  <Page size="A4" style={styles.page}>
    <View
      style={{
        padding: 24,
        borderWidth: 1,
        borderRadius: 12,
        borderColor: '#fed7aa',
        backgroundColor: '#fff7ed',
      }}
    >
      <Text style={{ fontFamily: 'VarelaRound', textTransform: 'uppercase', fontSize: 10, color: '#dc2626' }}>
        Payment Instructions
      </Text>
      <Text style={{ fontFamily: 'VarelaRound', fontSize: 20, marginTop: 8, marginBottom: 6 }}>
        Thank you for partnering with us
      </Text>
      <Text style={{ fontSize: 11, color: '#92400e', marginBottom: 12 }}>
        Please ensure payment references the invoice number #{data.invoiceNumber} and notify us once funds are transferred.
      </Text>
      <Text>1. Verify the payee ({data.paidTo ?? data.subsidiaryEnglishName ?? 'Establish Records Limited'}).</Text>
      <Text>2. Confirm the bank information and FPS ID.</Text>
      <Text>3. Reference #{data.invoiceNumber} in remarks.</Text>
      <Text>4. Email the remittance to {data.subsidiaryEmail ?? 'account@establishrecords.com'}.</Text>
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
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 12, fontWeight: 700, marginTop: 6 }}>Invoice #: {data.invoiceNumber}</Text>
            {data.invoiceDateDisplay ? <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>Date: {data.invoiceDateDisplay}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', paddingLeft: 12 }}>
            <Text style={[styles.logoMark, { marginBottom: 6 }]}>E.</Text>
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 10, fontWeight: 700 }}>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
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
    {includeTotals ? (
      <>
        <Totals data={data} />
        <PaymentSummary data={data} />
      </>
    ) : null}
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
      descriptors.push({ kind: 'items', variantBase: 'B', items: data.items, pageIndex: 0, totalPagesForVariant: 1 })
      descriptors.push({ kind: 'items', variantBase: 'A', items: data.items, pageIndex: 0, totalPagesForVariant: 1 })
      descriptors.push({ kind: 'payment-details', title: 'Payment Details' })
      descriptors.push({ kind: 'payment-instructions', title: 'Payment Instructions' })
      break
  }
  return descriptors
}

export const buildClassicInvoiceDocument = (
  data: ClassicInvoiceDocInput,
  options?: { variant?: ClassicInvoiceVariant },
) => {
  const variant = options?.variant ?? 'bundle'
  const descriptors = buildDescriptors(variant, data)
  const qrPayload = buildHKFPSPayload(data.fpsId ?? data.fpsEmail ?? null, true, (typeof data.total === 'number' ? data.total : data.amount) ?? null)
  const pages: React.ReactElement[] = []
  const totalPages = descriptors.length
  descriptors.forEach((descriptor, index) => {
    const pageNumber = index + 1
    if (descriptor.kind === 'items') {
      const isLastPageForVariant = descriptor.pageIndex === descriptor.totalPagesForVariant - 1
      const shouldShowTotals = isLastPageForVariant
      const showFooter =
        descriptor.variantBase === 'B'
          ? isLastPageForVariant
          : true
      pages.push(
        renderItemPage(
          data,
          descriptor,
          pageNumber,
          totalPages,
          shouldShowTotals,
          showFooter,
        ),
      )
    } else if (descriptor.kind === 'payment-details') {
      pages.push(<PaymentDetailsPage key={`details-${index}`} data={data} qrPayload={qrPayload} pageNumber={pageNumber} totalPages={totalPages} />)
    } else {
      pages.push(<PaymentInstructionsPage key={`instructions-${index}`} data={data} pageNumber={pageNumber} totalPages={totalPages} />)
    }
  })

  return <Document>{pages}</Document>
}
