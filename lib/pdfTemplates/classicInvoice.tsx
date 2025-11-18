import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { amountHK, num2eng, num2chi } from '../invoiceFormat'

const KARLA_URL = 'https://fonts.gstatic.com/s/karla/v31/Qw3KOZ2NCQ.woff'
const EB_GARAMOND_URL = 'https://fonts.gstatic.com/s/ebgaramond/v27/SlGTmQYL63.woff'

try {
  Font.register({ family: 'Karla', src: KARLA_URL })
  Font.register({ family: 'EBGaramond', src: EB_GARAMOND_URL })
} catch {
  // ignore font registration errors in serverless
}

const baseStyles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 28,
    fontFamily: 'Karla',
    fontSize: 10,
    color: '#111827',
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  logo: {
    fontFamily: 'EBGaramond',
    fontSize: 42,
    fontWeight: 700,
  },
  billToBlock: {
    marginBottom: 14,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#475569',
    marginBottom: 3,
  },
  value: {
    fontSize: 12,
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#0f172a',
    paddingBottom: 4,
    marginBottom: 6,
  },
  descHeader: {
    fontWeight: 700,
    letterSpacing: 1,
  },
  amountHeader: {
    fontWeight: 700,
    letterSpacing: 1,
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  totals: {
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
  paymentBlock: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#cbd5e1',
  },
  paymentLine: {
    marginBottom: 4,
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
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: string | null
  presenterWorkType?: string | null
  projectTitle?: string | null
  projectNature?: string | null
  subsidiaryEnglishName?: string | null
  subsidiaryChineseName?: string | null
  items: ClassicInvoiceItem[]
  subtotal?: number | null
  total?: number | null
  amount?: number | null
  paidTo?: string | null
  paymentStatus?: string | null
  bankName?: string | null
  bankCode?: string | null
  accountType?: string | null
}

const renderItems = (items: ClassicInvoiceItem[]) => {
  if (!items?.length) {
    return (
      <View style={{ paddingVertical: 12 }}>
        <Text>No items added.</Text>
      </View>
    )
  }
  return (
    <View>
      <View style={baseStyles.tableHeader}>
        <Text style={baseStyles.descHeader}>Description</Text>
        <Text style={baseStyles.amountHeader}>Amount</Text>
      </View>
      {items.map((item, index) => {
        const calc =
          (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discount ?? 0)
        return (
          <View key={`${item.title}-${index}`} style={baseStyles.itemRow}>
            <View style={{ width: '70%', paddingRight: 12 }}>
              <Text style={{ fontWeight: 600 }}>
                {item.title || 'Untitled Item'}
                {item.subQuantity ? ` · ${item.subQuantity}` : ''}
              </Text>
              {item.feeType ? (
                <Text style={{ fontStyle: 'italic' }}>{item.feeType}</Text>
              ) : null}
              {item.notes ? (
                <Text style={{ marginTop: 4 }}>{item.notes}</Text>
              ) : null}
              <Text style={{ marginTop: 2, fontStyle: 'italic' }}>
                {amountHK(item.unitPrice ?? 0)} x {item.quantity ?? 0}
                {item.quantityUnit ? `/${item.quantityUnit}` : ''} = {amountHK(calc)}
              </Text>
            </View>
            <View style={{ width: '30%', alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: 700 }}>{amountHK(calc)}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const amountWordsBlock = (amount: number) => (
  <View style={{ marginTop: 6 }}>
    <Text style={{ fontStyle: 'italic' }}>For the amount of: {num2eng(amount)}</Text>
    <Text style={{ fontStyle: 'italic' }}>茲付金額：{num2chi(amount)}</Text>
  </View>
)

const buildPaymentBlock = (data: ClassicInvoiceDocInput) => (
  <View style={baseStyles.paymentBlock}>
    {data.bankName ? (
      <Text style={baseStyles.paymentLine}>
        Total: {amountHK(typeof data.total === 'number' ? data.total : data.amount ?? 0)}
      </Text>
    ) : null}
    {data.paidTo ? (
      <Text style={baseStyles.paymentLine}>To: {data.paidTo}</Text>
    ) : null}
    {data.paymentStatus ? (
      <Text style={[baseStyles.paymentLine, { fontStyle: 'italic' }]}>
        {data.paymentStatus}
      </Text>
    ) : null}
    {data.bankName ? (
      <Text style={baseStyles.paymentLine}>
        Bank: {data.bankName}
        {data.bankCode ? ` (${data.bankCode})` : ''} — {data.accountType ?? 'Account'}
      </Text>
    ) : null}
  </View>
)

const renderHeaderVariant = (
  data: ClassicInvoiceDocInput,
  variant: 'A' | 'B',
  invoiceDate: string,
) => {
  if (variant === 'A') {
    return (
      <View style={baseStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={baseStyles.label}>Invoice #</Text>
          <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            #{data.invoiceNumber}
          </Text>
          <Text style={baseStyles.label}>Presenter / Worktype</Text>
          <Text style={baseStyles.value}>{data.presenterWorkType ?? '-'}</Text>
          <Text style={[baseStyles.label, { marginTop: 6 }]}>Project Title</Text>
          <Text style={{ fontSize: 11, fontWeight: 700 }}>{data.projectTitle ?? '-'}</Text>
          {data.projectNature ? (
            <Text style={{ fontStyle: 'italic' }}>{data.projectNature}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={baseStyles.logo}>E.</Text>
          <Text>{invoiceDate}</Text>
        </View>
      </View>
    )
  }
  return (
    <View style={baseStyles.header}>
      <View>
        <Text style={baseStyles.logo}>E.</Text>
        <Text style={{ fontSize: 10, marginTop: 4 }}>Establish Records Limited</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={baseStyles.label}>Invoice #</Text>
        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          #{data.invoiceNumber}
        </Text>
        <Text style={baseStyles.label}>Date</Text>
        <Text>{invoiceDate}</Text>
      </View>
    </View>
  )
}

const renderBillTo = (data: ClassicInvoiceDocInput) => (
  <View style={baseStyles.billToBlock}>
    <Text style={baseStyles.label}>Bill To</Text>
    <Text style={{ fontSize: 13, fontWeight: 700 }}>{data.companyName ?? '-'}</Text>
    {data.addressLine1 ? <Text>{data.addressLine1}</Text> : null}
    {data.addressLine2 ? <Text>{data.addressLine2}</Text> : null}
    {(data.addressLine3 || data.region) ? (
      <Text>{[data.addressLine3, data.region].filter(Boolean).join(', ')}</Text>
    ) : null}
    {data.representative ? (
      <Text style={{ fontWeight: 700, fontStyle: 'italic', marginTop: 4 }}>
        ATTN: {data.representative}
      </Text>
    ) : null}
  </View>
)

const renderTotals = (data: ClassicInvoiceDocInput) => {
  const subtotal = typeof data.subtotal === 'number' ? data.subtotal : null
  const total = typeof data.total === 'number'
    ? data.total
    : (typeof data.amount === 'number' ? data.amount : 0)
  return (
    <View style={baseStyles.totals}>
      {subtotal !== null ? (
        <View style={baseStyles.totalsRow}>
          <Text>Sub-total</Text>
          <Text>{amountHK(subtotal)}</Text>
        </View>
      ) : null}
      <View style={[baseStyles.totalsRow, { marginTop: 6 }]}>
        <Text style={{ fontSize: 12, fontWeight: 700 }}>Invoice Total</Text>
        <Text style={{ fontSize: 12, fontWeight: 700 }}>{amountHK(total)}</Text>
      </View>
      {amountWordsBlock(total)}
    </View>
  )
}

const PaymentDetailsPage = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <Page size="A4" style={baseStyles.page}>
    <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
      Payment Details
    </Text>
    <Text>Subsidiary: {data.subsidiaryEnglishName ?? '-'}</Text>
    <Text>Bank: {data.bankName ?? '-'} {data.bankCode ? `(${data.bankCode})` : ''}</Text>
    <Text>Account Type: {data.accountType ?? '-'}</Text>
    <Text style={{ marginTop: 12 }}>
      Please ensure payment references the invoice number #{data.invoiceNumber} for reconciliation.
    </Text>
  </Page>
)

const InvoicePage = ({
  data,
  variant,
  invoiceDate,
}: {
  data: ClassicInvoiceDocInput
  variant: 'A' | 'B'
  invoiceDate: string
}) => (
  <Page size="A4" style={baseStyles.page}>
    {renderHeaderVariant(data, variant, invoiceDate)}
    {renderBillTo(data)}
    {renderItems(data.items)}
    {renderTotals(data)}
    {buildPaymentBlock(data)}
  </Page>
)

export const buildClassicInvoiceDocument = (
  data: ClassicInvoiceDocInput,
) => {
  const invoiceDate = new Date().toLocaleDateString('en-HK')
  return (
    <Document>
      <InvoicePage data={data} variant="B" invoiceDate={invoiceDate} />
      <InvoicePage data={data} variant="A" invoiceDate={invoiceDate} />
      <InvoicePage data={data} variant="A" invoiceDate={invoiceDate} />
      <PaymentDetailsPage data={data} />
    </Document>
  )
}
