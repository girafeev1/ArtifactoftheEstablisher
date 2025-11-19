import React from 'react'
import path from 'path'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { amountHK, num2eng, num2chi } from '../invoiceFormat'

const FONT_DIR = path.join(process.cwd(), 'lib/pdfTemplates/fonts')
const KARLA_URL = 'https://fonts.gstatic.com/s/karla/v31/Qw3KOZ2NCQ.woff'

const registerFont = (family: string, fonts: { src: string; fontWeight?: number }[]) => {
  try {
    Font.register({ family, fonts })
  } catch {
    // ignore font register errors for serverless builds
  }
}

registerFont('RobotoMono', [
  { src: path.join(FONT_DIR, 'RobotoMono-Regular.ttf'), fontWeight: 400 },
  { src: path.join(FONT_DIR, 'RobotoMono-Bold.ttf'), fontWeight: 700 },
])
registerFont('VarelaRound', [{ src: path.join(FONT_DIR, 'VarelaRound-Regular.ttf') }])
registerFont('RampartOne', [{ src: path.join(FONT_DIR, 'RampartOne-Regular.ttf') }])
registerFont('Iansui', [{ src: path.join(FONT_DIR, 'Iansui-Regular.ttf') }])
try {
  Font.register({ family: 'Karla', src: KARLA_URL })
} catch {
  // ignore remote font failure
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'RobotoMono',
    fontSize: 10,
    color: '#0f172a',
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 32,
    lineHeight: 1.35,
  },
  pageAlt: {
    fontFamily: 'RobotoMono',
    fontSize: 10,
    color: '#0f172a',
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    lineHeight: 1.35,
  },
  paymentPage: {
    fontFamily: 'RobotoMono',
    fontSize: 10,
    color: '#0f172a',
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 44,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#475569',
    marginBottom: 4,
  },
  labelMuted: {
    fontSize: 9,
    color: '#6b7280',
  },
  logoMark: {
    fontFamily: 'RampartOne',
    fontSize: 46,
    color: '#111827',
  },
  companyEn: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  companyZh: {
    fontSize: 10,
    fontFamily: 'Iansui',
    letterSpacing: 1,
  },
  addressLine: {
    fontSize: 10,
  },
  contactLine: {
    fontSize: 10,
  },
  billBlock: {
    flex: 1,
    paddingRight: 18,
  },
  metaBlock: {
    width: 200,
    borderLeftWidth: 1,
    borderColor: '#cbd5f5',
    paddingLeft: 16,
  },
  metaAltBlock: {
    width: 240,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    borderRadius: 6,
  },
  billName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 2,
  },
  invoiceLabel: {
    fontFamily: 'VarelaRound',
    fontSize: 18,
    letterSpacing: 1.2,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 4,
  },
  projectTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  projectNature: {
    fontStyle: 'italic',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.4,
    borderColor: '#111827',
    paddingBottom: 6,
    marginTop: 18,
    marginBottom: 4,
  },
  tableColDesc: {
    width: '70%',
    paddingRight: 16,
  },
  tableColAmount: {
    width: '30%',
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
  },
  itemTitle: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 2,
  },
  itemNote: {
    fontSize: 10,
    color: '#1f2937',
    marginTop: 2,
  },
  itemMeta: {
    fontStyle: 'italic',
    fontSize: 9,
    marginTop: 4,
    color: '#6b7280',
  },
  amountCell: {
    fontWeight: 700,
    fontSize: 11,
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
  totalLabel: {
    fontSize: 11,
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 700,
  },
  amountWords: {
    marginTop: 10,
    fontStyle: 'italic',
  },
  amountWordsZh: {
    fontFamily: 'Iansui',
    marginTop: 2,
    fontSize: 11,
  },
  paymentSummary: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#cbd5e1',
  },
  paymentLine: {
    marginBottom: 4,
  },
  footerContact: {
    marginTop: 18,
    fontSize: 9,
    color: '#475569',
  },
  footerEn: {
    fontSize: 10,
    fontWeight: 700,
  },
  footerZh: {
    fontFamily: 'Iansui',
    marginTop: 2,
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  playfulCard: {
    borderRadius: 12,
    padding: 20,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  playfulHeading: {
    fontFamily: 'VarelaRound',
    fontSize: 18,
    marginBottom: 6,
  },
  playfulSub: {
    fontSize: 10,
    color: '#92400e',
    marginBottom: 12,
  },
  badge: {
    fontFamily: 'Karla',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#dc2626',
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

const computeLineTotal = (item: ClassicInvoiceItem): number => {
  const unit = typeof item.unitPrice === 'number' ? item.unitPrice : 0
  const qty = typeof item.quantity === 'number' ? item.quantity : 0
  const discount = typeof item.discount === 'number' ? item.discount : 0
  return unit * qty - discount
}

const computeTotals = (data: ClassicInvoiceDocInput) => {
  const subtotal =
    typeof data.subtotal === 'number'
      ? data.subtotal
      : data.items.reduce((sum, item) => sum + computeLineTotal(item), 0)
  const totalCandidate =
    typeof data.total === 'number'
      ? data.total
      : typeof data.amount === 'number'
        ? data.amount
        : subtotal
  const adjustment = totalCandidate - subtotal
  return { subtotal, total: totalCandidate, adjustment }
}

const notEmpty = (value?: string | null) => Boolean(value && value.trim().length)

const joinAddress = (parts: (string | null | undefined)[]) =>
  parts.map((p) => (p || '').trim()).filter(Boolean).join(', ')

const renderAddressLines = (lines: (string | null | undefined)[]) =>
  lines
    .filter((line): line is string => notEmpty(line))
    .map((line, idx) => (
      <Text key={`addr-${idx}`} style={styles.addressLine}>
        {line}
      </Text>
    ))

const BillTo = ({ data }: { data: ClassicInvoiceDocInput }) => {
  const addressLines = [
    data.addressLine1,
    data.addressLine2,
    joinAddress([data.addressLine3, data.region]),
  ].filter((line): line is string => notEmpty(line))
  return (
    <View style={styles.billBlock}>
      <Text style={styles.sectionLabel}>Bill To</Text>
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
  <View>
    <Text style={styles.sectionLabel}>Project Detail</Text>
    {data.presenterWorkType ? <Text>{data.presenterWorkType}</Text> : null}
    {data.projectTitle ? <Text style={styles.projectTitle}>{data.projectTitle}</Text> : null}
    {data.projectNature ? <Text style={styles.projectNature}>{data.projectNature}</Text> : null}
    {data.projectNumber ? <Text>Project #: {data.projectNumber}</Text> : null}
    {data.projectDate ? <Text>Project Date: {data.projectDate}</Text> : null}
    {data.projectPickupDate ? <Text>Pickup Date: {data.projectPickupDate}</Text> : null}
  </View>
)

const ItemsTable = ({ data }: { data: ClassicInvoiceDocInput }) => {
  if (!data.items || data.items.length === 0) {
    return (
      <View style={{ paddingVertical: 16 }}>
        <Text>No items added.</Text>
      </View>
    )
  }
  return (
    <View>
      <View style={styles.tableHeader}>
        <View style={styles.tableColDesc}>
          <Text style={{ fontWeight: 700, letterSpacing: 0.8 }}>Description</Text>
        </View>
        <View style={styles.tableColAmount}>
          <Text style={{ fontWeight: 700, letterSpacing: 0.8 }}>Amount</Text>
        </View>
      </View>
      {data.items.map((item, idx) => {
        const total = computeLineTotal(item)
        return (
          <View key={`item-${idx}`} style={styles.itemRow}>
            <View style={styles.tableColDesc}>
              <Text style={styles.itemTitle}>{item.title || `Item ${idx + 1}`}</Text>
              {item.subQuantity ? <Text>{item.subQuantity}</Text> : null}
              {item.feeType ? <Text style={{ fontStyle: 'italic' }}>{item.feeType}</Text> : null}
              {item.notes ? (
                <Text style={styles.itemNote}>{item.notes}</Text>
              ) : null}
              <Text style={styles.itemMeta}>
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
      })}
    </View>
  )
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
        <Text style={styles.totalLabel}>Invoice Total</Text>
        <Text style={styles.totalValue}>{amountHK(total)}</Text>
      </View>
      <View style={styles.amountWords}>
        <Text>For the amount of: {num2eng(total) || amountHK(total)}</Text>
        <Text style={styles.amountWordsZh}>茲付金額：{num2chi(total)}</Text>
      </View>
    </View>
  )
}

const PaymentSummary = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <View style={styles.paymentSummary}>
    <Text style={styles.paymentLine}>
      Cheque Payable To: {data.paidTo ?? data.subsidiaryEnglishName ?? '-'}
    </Text>
    {data.bankName ? (
      <Text style={styles.paymentLine}>
        Bank: {data.bankName}
        {data.bankCode ? ` (${data.bankCode})` : ''}
        {data.accountType ? ` — ${data.accountType}` : ''}
      </Text>
    ) : null}
    {data.bankAccountNumber ? (
      <Text style={styles.paymentLine}>Bank Account Number: {data.bankAccountNumber}</Text>
    ) : null}
    {data.fpsId ? (
      <Text style={styles.paymentLine}>FPS ID: {data.fpsId}</Text>
    ) : null}
    {data.paymentStatus ? (
      <Text style={[styles.paymentLine, { fontStyle: 'italic', color: '#7f1d1d' }]}>Status: {data.paymentStatus}</Text>
    ) : null}
  </View>
)

const Footer = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <View style={styles.footerContact}>
    <Text style={styles.footerEn}>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
    {data.subsidiaryChineseName ? <Text style={styles.footerZh}>{data.subsidiaryChineseName}</Text> : null}
    {renderAddressLines(data.subsidiaryAddressLines ?? [])}
    {data.subsidiaryPhone ? <Text style={styles.contactLine}>{data.subsidiaryPhone}</Text> : null}
    {data.subsidiaryEmail ? <Text style={styles.contactLine}>{data.subsidiaryEmail}</Text> : null}
  </View>
)

const VersionBPage = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.logoMark}>E.</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.companyEn}>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
        {data.subsidiaryChineseName ? <Text style={styles.companyZh}>{data.subsidiaryChineseName}</Text> : null}
        {renderAddressLines(data.subsidiaryAddressLines ?? [])}
        {data.subsidiaryPhone ? <Text style={styles.contactLine}>{data.subsidiaryPhone}</Text> : null}
        {data.subsidiaryEmail ? <Text style={styles.contactLine}>{data.subsidiaryEmail}</Text> : null}
      </View>
    </View>
    <View style={[styles.headerRow, { marginBottom: 18 }]}>
      <BillTo data={data} />
      <View style={styles.metaBlock}>
        <Text style={styles.sectionLabel}>Invoice</Text>
        <Text style={styles.invoiceNumber}>#{data.invoiceNumber}</Text>
        {data.invoiceDateDisplay ? <Text>Issued Date: {data.invoiceDateDisplay}</Text> : null}
        <View style={{ marginTop: 12 }}>
          <ProjectMeta data={data} />
        </View>
      </View>
    </View>
    <ItemsTable data={data} />
    <Totals data={data} />
    <PaymentSummary data={data} />
    {data.paymentTerms ? (
      <Text style={{ marginTop: 10, fontWeight: 600 }}>PAYMENT TERMS: {data.paymentTerms}</Text>
    ) : null}
    <Footer data={data} />
  </Page>
)

const VersionAPage = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <Page size="A4" style={styles.pageAlt}>
    <View style={styles.headerRow}>
      <View style={{ flex: 1, paddingRight: 18 }}>
        <Text style={styles.invoiceLabel}>Invoice</Text>
        <Text style={styles.invoiceNumber}>#{data.invoiceNumber}</Text>
        {data.invoiceDateDisplay ? <Text>Date: {data.invoiceDateDisplay}</Text> : null}
        {data.projectNumber ? <Text style={{ marginTop: 6 }}>Project #: {data.projectNumber}</Text> : null}
        {data.projectDate ? <Text>Project Date: {data.projectDate}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.logoMark}>E.</Text>
        <Text style={styles.companyEn}>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
        {data.subsidiaryChineseName ? <Text style={styles.companyZh}>{data.subsidiaryChineseName}</Text> : null}
        {renderAddressLines(data.subsidiaryAddressLines ?? [])}
      </View>
    </View>
    <View style={[styles.headerRow, { marginBottom: 16 }]}>
      <BillTo data={data} />
      <View style={styles.metaAltBlock}>
        <ProjectMeta data={data} />
      </View>
    </View>
    <ItemsTable data={data} />
    <Totals data={data} />
    <PaymentSummary data={data} />
    {data.paymentTerms ? (
      <Text style={{ marginTop: 8 }}>Payment Terms: {data.paymentTerms}</Text>
    ) : null}
    <Footer data={data} />
  </Page>
)

const FormalPaymentPage = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <Page size="A4" style={styles.paymentPage}>
    <Text style={{ fontFamily: 'VarelaRound', fontSize: 22, textAlign: 'center', marginBottom: 20 }}>Payment Details</Text>
    <View style={styles.paymentCard}>
      <Text style={styles.sectionLabel}>Payee</Text>
      <Text style={{ fontSize: 12, fontWeight: 700 }}>{data.paidTo ?? data.subsidiaryEnglishName ?? '-'}</Text>
      <Text>{data.subsidiaryEnglishName ?? ''}</Text>
      {renderAddressLines(data.subsidiaryAddressLines ?? [])}
    </View>
    <View style={styles.paymentCard}>
      <Text style={styles.sectionLabel}>Bank Information</Text>
      <Text>Bank: {data.bankName ?? '-'}</Text>
      {data.bankCode ? <Text>Bank Code: {data.bankCode}</Text> : null}
      <Text>Account Type: {data.accountType ?? '-'}</Text>
      <Text>Account Number: {data.bankAccountNumber ?? '-'}</Text>
      {data.fpsId ? <Text>FPS ID: {data.fpsId}</Text> : null}
      {data.fpsEmail ? <Text>FPS Email: {data.fpsEmail}</Text> : null}
    </View>
    {data.paymentTerms ? (
      <View style={styles.paymentCard}>
        <Text style={styles.sectionLabel}>Terms</Text>
        <Text>{data.paymentTerms}</Text>
      </View>
    ) : null}
    <Footer data={data} />
  </Page>
)

const PlayfulPaymentPage = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <Page size="A4" style={styles.paymentPage}>
    <View style={styles.playfulCard}>
      <Text style={styles.badge}>Receipt Companion</Text>
      <Text style={styles.playfulHeading}>Payment Instructions</Text>
      <Text style={styles.playfulSub}>Double check the amount and bank details before submitting your transfer.</Text>
      <Text style={{ fontSize: 11, marginBottom: 6 }}>Pay To</Text>
      <Text style={{ fontSize: 14, fontWeight: 700 }}>{data.paidTo ?? data.subsidiaryEnglishName ?? '-'}</Text>
      <Text style={{ marginTop: 8 }}>Bank: {data.bankName ?? '-'} {data.bankCode ? `(${data.bankCode})` : ''}</Text>
      <Text>Account Number: {data.bankAccountNumber ?? '-'}</Text>
      {data.fpsId ? <Text>FPS: {data.fpsId}</Text> : null}
      {data.paymentTerms ? (
        <Text style={{ marginTop: 12, fontWeight: 600 }}>Payment Terms: {data.paymentTerms}</Text>
      ) : null}
    </View>
    <Footer data={data} />
  </Page>
)

const buildPagesForVariant = (data: ClassicInvoiceDocInput, variant: ClassicInvoiceVariant) => {
  switch (variant) {
    case 'A':
      return [<VersionAPage key="A-main" data={data} />, <FormalPaymentPage key="A-pay" data={data} />]
    case 'A2':
      return [<VersionAPage key="A2-main" data={data} />, <PlayfulPaymentPage key="A2-pay" data={data} />]
    case 'B':
      return [<VersionBPage key="B-main" data={data} />]
    case 'B2':
      return [<VersionBPage key="B2-main" data={data} />, <PlayfulPaymentPage key="B2-pay" data={data} />]
    case 'bundle':
    default:
      return [
        <VersionBPage key="bundle-b" data={data} />,
        <VersionAPage key="bundle-a" data={data} />,
        <FormalPaymentPage key="bundle-pay" data={data} />,
        <PlayfulPaymentPage key="bundle-cute" data={data} />,
      ]
  }
}

export const buildClassicInvoiceDocument = (
  data: ClassicInvoiceDocInput,
  options?: { variant?: ClassicInvoiceVariant },
) => {
  const variant = options?.variant ?? 'bundle'
  const pages = buildPagesForVariant(data, variant)
  return <Document>{pages}</Document>
}
