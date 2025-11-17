import Head from "next/head"
import { useRouter } from "next/router"
import { Button, Space, Typography, Select, Tag } from "antd"
import React from "react"

const { Title, Text } = Typography

const variants = [
  { value: 'bundle', label: 'Full Bundle (4 pages)' },
  { value: 'A', label: 'Version A' },
  { value: 'A2', label: 'Version A2' },
  { value: 'B', label: 'Version B' },
  { value: 'B2', label: 'Version B2' },
]

export default function InvoicePreviewPage() {
  const router = useRouter()
  const { projectId, invoiceNumber } = router.query as { projectId?: string; invoiceNumber?: string }
  const year = (router.query.year as string) || ''
  const [variant, setVariant] = React.useState<string>('bundle')
  const [itemsPages, setItemsPages] = React.useState<number | null>(null)

  const projectNumber = (router.query.projectNumber as string) || ''

  const pdfUrl = React.useMemo(() => {
    if (!year || !projectId || !invoiceNumber) return ''
    const u = `/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(projectId)}/${encodeURIComponent(invoiceNumber)}/pdf?variant=${encodeURIComponent(variant)}&inline=1&ts=${Date.now()}`
    return u
  }, [year, projectId, invoiceNumber, variant])

  const fetchMeta = React.useCallback(async () => {
    if (!year || !projectId || !invoiceNumber) return
    try {
      const resp = await fetch(`/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(projectId)}/${encodeURIComponent(invoiceNumber)}/pdf?meta=itemsPages&variant=${encodeURIComponent(variant)}&ts=${Date.now()}`)
      if (!resp.ok) return
      const json = await resp.json()
      setItemsPages(json.itemsPages ?? null)
    } catch {}
  }, [year, projectId, invoiceNumber, variant])

  React.useEffect(() => { fetchMeta() }, [fetchMeta])

  const onExport = React.useCallback(() => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl.replace('inline=1', 'inline=0')
    a.target = '_self'
    a.download = `Invoice-${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => document.body.removeChild(a), 0)
  }, [pdfUrl, invoiceNumber])

  const onBack = React.useCallback(() => {
    if (projectId) router.push(`/dashboard/new-ui/projects/show/${encodeURIComponent(projectId)}`)
  }, [router, projectId])

  return (
    <div className="preview-page">
      <Head><title>Invoice Preview · #{invoiceNumber}</title></Head>
      <div className="preview-inner">
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
          <Button onClick={onBack}>&larr; Back to {projectNumber || 'Project'}</Button>
          <Space>
            <Select value={variant} onChange={setVariant} options={variants} size="middle" />
            <Button type="primary" danger onClick={onExport}>
              Export PDF
              <span style={{ marginLeft: 6 }}>▾</span>
            </Button>
          </Space>
        </Space>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Title level={4} style={{ margin: 0 }}>Preview — #{invoiceNumber}</Title>
          {itemsPages ? <Tag color="blue" style={{ fontFamily: 'Karla, sans-serif' }}>Items span: ({itemsPages} page{itemsPages > 1 ? 's' : ''})</Tag> : null}
        </div>
        <div className="viewer-wrap">
          {pdfUrl ? (
            <object data={pdfUrl} type="application/pdf" width="100%" height="100%">
              <iframe title="invoice-pdf" src={pdfUrl} width="100%" height="100%" />
            </object>
          ) : (
            <Text>Preparing preview…</Text>
          )}
        </div>
      </div>
      <style jsx>{`
        .preview-page { padding: 16px; }
        .preview-inner { max-width: 1200px; margin: 0 auto; }
        .viewer-wrap { height: 80vh; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background: #fff; }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&display=swap" rel="stylesheet" />
    </div>
  )
}

