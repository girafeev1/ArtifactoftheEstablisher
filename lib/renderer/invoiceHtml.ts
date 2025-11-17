import { amountHK, num2eng, num2chi } from '../invoiceFormat'

export type InvoiceItem = {
  title?: string | null
  subQuantity?: string | null
  feeType?: string | null
  notes?: string | null
  unitPrice?: number | null
  quantity?: number | null
  quantityUnit?: string | null
  discount?: number | null
}

export type InvoiceData = {
  invoiceNumber: string
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: string | null
  items: InvoiceItem[]
  subtotal?: number | null
  total?: number | null
  amount?: number | null
  paidTo?: string | null
  paymentStatus?: string | null
  subsidiaryEnglishName?: string | null
}

export type InvoiceVariant = 'A' | 'A2' | 'B' | 'B2' | 'bundle'

function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function headerHtml(inv: InvoiceData, variant: InvoiceVariant) {
  const today = new Date().toLocaleDateString('en-HK')
  const logoBlock = `<div class="logo">E.</div>`
  const subBlock = `<div class="sub-info">${esc(inv.subsidiaryEnglishName ?? inv.companyName ?? '')}</div>`
  const invBlock = `<div class="inv-info"><div class="inv-title">Invoice</div><div class="inv-no">Invoice #${esc(inv.invoiceNumber)}</div><div class="inv-date">${esc(today)}</div></div>`
  if (variant === 'A' || variant === 'A2') {
    return `<div class="header a">${invBlock}${logoBlock}</div>`
  }
  // B/B2 default: logo left, company block right
  return `<div class="header b">${logoBlock}${subBlock}</div>`
}

function clientInvoiceBlocks(inv: InvoiceData, variant: InvoiceVariant) {
  const client = [
    '<div class="block bill-to"><div class="label">BILL TO:</div>',
    esc(inv.companyName),
    inv.addressLine1 ? `<div>${esc(inv.addressLine1)}</div>` : '',
    inv.addressLine2 ? `<div>${esc(inv.addressLine2)}</div>` : '',
    (inv.addressLine3 || inv.region) ? `<div>${esc([inv.addressLine3, inv.region].filter(Boolean).join(', '))}</div>` : '',
    inv.representative ? `<div class="attn">Attn: <span class="rep">${esc(inv.representative)}</span></div>` : '',
    '</div>'
  ].join('')
  const invInfo = [
    '<div class="block inv-meta">',
    `<div class="label">Invoice #:</div><div class="value">#${esc(inv.invoiceNumber)}</div>`,
    '</div>'
  ].join('')
  return `<div class="client-invoice-row">${client}${invInfo}</div>`
}

function itemsTable(inv: InvoiceData) {
  const rows = inv.items.map((it) => {
    const lineTotal = (it.unitPrice ?? 0) * (it.quantity ?? 0) - (it.discount ?? 0)
    const left = [
      `<div class="title"><strong>${esc(it.title ?? '')}</strong>${it.subQuantity ? ` <em>x${esc(it.subQuantity)}</em>` : ''}</div>`,
      it.feeType ? `<div class="fee"><em>${esc(it.feeType)}</em></div>` : '',
      it.notes ? `<div class="notes">${esc(it.notes)}</div>` : '',
    ].join('')
    const right = [
      `<div class="calc"><em>${esc(amountHK(it.unitPrice ?? 0))} x ${(it.quantity ?? 0)}${it.quantityUnit ? `/${esc(it.quantityUnit)}` : ''} = </em><strong>${esc(amountHK(lineTotal))}</strong></div>`,
    ].join('')
    return `<div class="item-row"><div class="desc">${left}</div><div class="amt">${right}</div></div>`
  }).join('')
  return `<div class="items"><div class="thead"><div>DESCRIPTION</div><div class="r">AMOUNT</div></div>${rows}</div>`
}

function totalsBlock(inv: InvoiceData) {
  const total = typeof inv.total === 'number' ? inv.total : (typeof inv.amount === 'number' ? inv.amount : 0)
  return `
  <div class="totals">
    <div class="words-en">For the amount of: ${esc(num2eng(total))}</div>
    <div class="total-row"><div class="label">INVOICE TOTAL</div><div class="value">${esc(amountHK(total))}</div></div>
    <div class="words-chi">茲付金額：${esc(num2chi(total))}</div>
  </div>`
}

function footerBlock(inv: InvoiceData, variant: InvoiceVariant) {
  if (variant === 'A' || variant === 'A2') {
    return `<div class="footer a">${esc(inv.subsidiaryEnglishName ?? inv.companyName ?? '')}</div>`
  }
  const paidTo = inv.paidTo ? `<div class="to">To: ${esc(inv.paidTo)}</div>` : ''
  const status = inv.paymentStatus ? `<div class="status"><em>${esc(inv.paymentStatus)}</em></div>` : ''
  return `<div class="footer b">${paidTo}${status}</div>`
}

function baseCss() {
  // A4 with 0.2" top/bottom and 0.3" left/right
  return `
  @page { size: A4; margin: 0.2in 0.3in; }
  * { box-sizing: border-box; }
  body { font-family: 'Karla', Arial, sans-serif; color: #111827; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; }
  .header .logo { font-family: 'EB Garamond', serif; font-weight: 700; font-size: 42px; line-height: 1; }
  .header .inv-title { font-family: 'Karla', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 1px; }
  .header .inv-no { font-size: 12px; }
  .sub-info { text-align: right; font-size: 12px; }
  .client-invoice-row { display: grid; grid-template-columns: 1fr 220px; gap: 16px; margin-top: 8px; }
  .block .label { font-weight: 700; letter-spacing: 1px; font-size: 12px; }
  .bill-to .attn .rep { font-weight: 700; font-style: italic; }
  .items { margin-top: 16px; }
  .items .thead { display: grid; grid-template-columns: 1fr 220px; font-weight: 700; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 4px; }
  .items .thead .r { text-align: right; }
  .item-row { display: grid; grid-template-columns: 1fr 220px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
  .item-row .amt { text-align: right; white-space: pre-wrap; }
  .item-row .desc .title { font-size: 12px; }
  .item-row .desc .fee { font-size: 11px; font-style: italic; }
  .item-row .desc .notes { white-space: pre-wrap; font-size: 11px; }
  .totals { margin-top: 16px; }
  .totals .total-row { display: grid; grid-template-columns: 1fr 220px; align-items: baseline; font-weight: 700; margin: 6px 0; }
  .totals .total-row .value { text-align: right; }
  .totals .words-en, .totals .words-chi { font-size: 11px; margin: 4px 0; }
  .footer { margin-top: 12px; font-size: 11px; }
  .footer.b .to { }
  .footer.b .status { font-style: italic; }
  `
}

export function buildInvoiceHtml(inv: InvoiceData, variant: InvoiceVariant): string {
  const v: InvoiceVariant = variant || 'bundle'
  const single = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@700&family=Karla:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>${baseCss()}</style>
    </head>
    <body>
      ${headerHtml(inv, v)}
      ${clientInvoiceBlocks(inv, v)}
      ${itemsTable(inv)}
      ${totalsBlock(inv)}
      ${footerBlock(inv, v)}
    </body>
  </html>`
  if (v !== 'bundle') return single
  // Bundle: B (all-in-one) + A + A + cute page (stub)
  const pageB = single
  const pageA = single.replace('class="header b"', 'class="header a"')
  const cute = `<!doctype html><html><head><meta charset="utf-8" /><style>@page{size:A4;margin:0.2in 0.3in;}body{font-family:'Karla',sans-serif}</style></head><body><div style="font-size:14px">Payment Details</div></body></html>`
  return pageB + '\n<!--pagebreak-->' + pageA + '\n<!--pagebreak-->' + pageA + '\n<!--pagebreak-->' + cute
}

