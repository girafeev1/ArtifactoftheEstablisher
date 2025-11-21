import Head from "next/head";
import { useRouter } from "next/router";
import { Button, Space, Typography, Tag, Dropdown, Empty, Spin } from "antd";
import type { MenuProps } from "antd";
import React, { useEffect, useState } from "react";
import AppShell from "../../../../../../../../components/new-ui/AppShell";
import { projectsDataProvider } from "../../../../../../../../components/projects/NewUIProjectsApp";
import GeneratedInvoice from "../../../../../../../../components/projects/GeneratedInvoice";
import type { InvoiceDraftState } from "../../../../../../../../components/projects/NewUIProjectShowApp";

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
  const [invoice, setInvoice] = useState<InvoiceDraftState | null>(null);
  const [loading, setLoading] = useState(true);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Title level={4} style={{ margin: 0 }}>Preview — #{invoiceNumber}</Title>
          </div>
          <div className="viewer-wrap">
            {loading ? (
              <Spin size="large" />
            ) : invoice ? (
              <GeneratedInvoice invoice={invoice} />
            ) : (
              <Empty description="Invoice not found" />
            )}
          </div>
        </div>
        <style jsx>{`
          .preview-page { padding: 16px; }
          .preview-inner { max-width: 1200px; margin: 0 auto; }
          .viewer-wrap { min-height: 80vh; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background: #fff; display: flex; justify-content: center; align-items: center; }
        `}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&display=swap" rel="stylesheet" />
      </div>
    </AppShell>
  )
}
