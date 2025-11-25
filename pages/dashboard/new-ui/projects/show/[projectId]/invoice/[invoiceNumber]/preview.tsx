import Head from "next/head";
import { useRouter } from "next/router";
import { Button, Space, Typography, Tag, Dropdown, Empty, Spin } from "antd";
// antd types can be finicky with Next's TS; inline menu config instead
import React, { useEffect, useState } from "react";
import AppShell from "../../../../../../../../components/new-ui/AppShell";
import { projectsDataProvider } from "../../../../../../../../components/projects/NewUIProjectsApp";
import GeneratedInvoice from "../../../../../../../../components/projects/GeneratedInvoice";
import type { ProjectInvoiceRecord } from "../../../../../../../../lib/projectInvoices";

const { Title, Text } = Typography;

const variants = [
  { value: 'bundle', label: 'Full Bundle (4 pages)' },
  { value: 'A', label: 'Version A' },
  { value: 'A2', label: 'Version A2' },
  { value: 'B', label: 'Version B' },
  { value: 'B2', label: 'Version B2' },
];

export default function InvoicePreviewPage() {
  const router = useRouter();
  const { projectId, invoiceNumber } = router.query as { projectId?: string; invoiceNumber?: string };
  const year = (router.query.year as string) || '';
  const [invoice, setInvoice] = useState<ProjectInvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [variant, setVariant] = useState<string>('bundle');

  const projectNumber = (router.query.projectNumber as string) || '';

  useEffect(() => {
    if (!year || !projectId || !invoiceNumber) return;
    setLoading(true);
    fetch(`/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(projectId)}/${encodeURIComponent(invoiceNumber)}`)
      .then(res => res.json())
      .then(data => {
        setInvoice(data.invoice);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [year, projectId, invoiceNumber]);
  
  const doExport = React.useCallback((v: string) => {
    if (!year || !projectId || !invoiceNumber) return
    const base = `/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(projectId)}/${encodeURIComponent(invoiceNumber)}/pdf?variant=${encodeURIComponent(v)}&inline=0&ts=${Date.now()}`
    const a = document.createElement('a')
    a.href = base
    a.target = '_self'
    a.download = `Invoice-${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => document.body.removeChild(a), 0)
  }, [year, projectId, invoiceNumber])

  const menuItems = variants.map(v => ({ key: v.value, label: v.label, onClick: () => doExport(v.value) }))
  const variantMenu = {
    items: variants.map(v => ({ key: v.value, label: v.label, onClick: () => setVariant(v.value) })),
  } as any

  const onBack = React.useCallback(() => {
    if (projectId) router.push(`/dashboard/new-ui/projects/show/${encodeURIComponent(projectId)}`)
  }, [router, projectId])

  return (
    <AppShell
      dataProvider={projectsDataProvider}
      resources={[{ name: 'projects', list: '/dashboard/new-ui/projects', meta: { label: 'Projects' } }]}
      allowedMenuKeys={['projects']}
    >
      <div className="preview-page">
        <Head><title>Invoice Preview · #{invoiceNumber}</title></Head>
        <div className="preview-inner">
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
            <Button onClick={onBack}>&larr; Back to {projectNumber || 'Project'}</Button>
            <Dropdown.Button
              type="primary"
              danger
              menu={{ items: menuItems }}
            >
              Export PDF
            </Dropdown.Button>
          </Space>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
            <Title level={4} style={{ margin: 0 }}>Preview — #{invoiceNumber}</Title>
            <Dropdown menu={variantMenu} trigger={["click"]}>
              <Button>Select Variant: {variants.find(v => v.value === variant)?.label || variant}</Button>
            </Dropdown>
          </Space>
          <div className="viewer-wrap">
            {loading ? (
              <Spin size="large" />
            ) : !invoice ? (
              <Empty description="Invoice not found" />
            ) : (
              // Inline PDF viewer rendering server-generated PDF (uses current variant)
              <object
                data={`/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(projectId!)}/${encodeURIComponent(invoiceNumber!)}/pdf?variant=${encodeURIComponent(variant)}&inline=1&ts=${Date.now()}`}
                type="application/pdf"
                width="100%"
                height="100%"
              >
                <iframe
                  src={`/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(projectId!)}/${encodeURIComponent(invoiceNumber!)}/pdf?variant=${encodeURIComponent(variant)}&inline=1&ts=${Date.now()}`}
                  width="100%"
                  height="100%"
                  title="Invoice PDF"
                />
              </object>
            )}
          </div>
        </div>
        <style jsx>{`
          .preview-page { padding: 16px; }
          .preview-inner { max-width: 1200px; margin: 0 auto; }
          /* Give the embedded <object/iframe> an explicit height container. */
          .viewer-wrap { height: 85vh; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background: #fff; display: flex; justify-content: center; align-items: stretch; }
        `}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&display=swap" rel="stylesheet" />
      </div>
    </AppShell>
  )
}
