import Head from "next/head";
import { useRouter } from "next/router";
import { Button, Space, Typography, Empty, Spin, Switch, Select } from "antd";
import React, { useEffect, useState, useMemo } from "react";
import AppShell from "../../../../../components/layout/AppShell";
import { projectsDataProvider } from "../../../../../components/projects/ProjectsApp";
import { Invoice } from "../../../../../lib/invoice";
import type { BankInfo, InvoiceVariant } from "../../../../../lib/invoice/types";
import type { ProjectInvoiceRecord } from "../../../../../lib/projectInvoices";
import type { ProjectRecord } from "../../../../../lib/projectsDatabase";
import { fetchSubsidiaryById, type SubsidiaryDoc } from "../../../../../lib/subsidiaries";
import { resolveBankAccountIdentifier } from "../../../../../lib/erlDirectory";
import { getAuthOptions } from "../../../../../pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import { num2eng, num2chi } from "../../../../../lib/invoiceFormat";
import { buildHKFPSPayload, buildHKFPSQrUrl } from "../../../../../lib/fpsPayload";
import { representativeNameOnly } from "../../../../../lib/representative";

const { Title, Text } = Typography;

export default function InvoicePreviewPage() {
  const router = useRouter();
  const { projectId, invoiceNumber } = router.query as { projectId?: string; invoiceNumber?: string };
  const year = (router.query.year as string) || '';
  const [invoice, setInvoice] = useState<ProjectInvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [subsidiary, setSubsidiary] = useState<SubsidiaryDoc | null>(null);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [showFlexDebug, setShowFlexDebug] = useState(false);
  const [invoiceVariant, setInvoiceVariant] = useState<InvoiceVariant>("B");
  const [bankInfo, setBankInfo] = useState<any | null>(null);
  const [projectReady, setProjectReady] = useState(false);
  const [subsidiaryReady, setSubsidiaryReady] = useState(false);
  const [bankReady, setBankReady] = useState(false);

  const projectNumber = (router.query.projectNumber as string) || '';
  const isPdfPreview = router.query.pdf === '1' || router.query.pdf === 'true';
  const pageTitle = invoiceNumber ? `Invoice Preview · #${invoiceNumber}` : 'Invoice Preview';

  // Initialise the grid toggle from the URL so that when the PDF endpoint
  // requests the preview with ?grid=1 we render with the grid outlines
  // enabled even though there is no visible switch interaction.
  useEffect(() => {
    if (!router.isReady) return;
    const gridParam = router.query.grid;
    if (gridParam === '1' || gridParam === 'true') {
      setShowGridOverlay(true);
    }
  }, [router.isReady, router.query.grid]);

  // Fetch invoice data
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

  // Fetch project meta (title, presenter/worktype, nature, subsidiary id, dates)
  useEffect(() => {
    if (!projectId) return;
    setProjectReady(false);
    const controller = new AbortController();
    const run = async () => {
      try {
        const res = await fetch(`/api/projects/by-id/${encodeURIComponent(projectId)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data) {
            setProject(data.data as ProjectRecord);
          }
        }
      } catch {
        // ignore; invoice still renders without project meta
      } finally {
        setProjectReady(true);
      }
    };
    void run();
    return () => controller.abort();
  }, [projectId]);

  // Look up subsidiary document for header/footer (bank block, address, etc.)
  useEffect(() => {
    setSubsidiaryReady(false);
    const run = async () => {
      const id = project?.subsidiary?.trim();
      if (!id) { setSubsidiary(null); setSubsidiaryReady(true); return; }
      try {
        const info = await fetchSubsidiaryById(id);
        setSubsidiary(info);
      } catch {
        setSubsidiary(null);
      } finally {
        setSubsidiaryReady(true);
      }
    };
    void run();
  }, [project?.subsidiary]);

  // Resolve bank info from the invoice's payTo identifier so we can bind
  // BankName/BankCode/account number tokens for the Instruction sheet.
  // payTo is the bank account for payment instructions (where client should pay)
  useEffect(() => {
    setBankReady(false);
    const run = async () => {
      if (!invoice?.payTo) {
        setBankInfo(null);
         setBankReady(true);
        return;
      }
      try {
        const info = await resolveBankAccountIdentifier(invoice.payTo);
        setBankInfo(info);
      } catch {
        setBankInfo(null);
      } finally {
        setBankReady(true);
      }
    };
    void run();
  }, [invoice?.payTo]);

  const onBack = React.useCallback(() => {
    if (projectId) router.push(`/projects/${encodeURIComponent(projectId)}`)
  }, [router, projectId])

  const onExportPdf = React.useCallback(() => {
    // Use browser's native print dialog - the print CSS already handles margins and layout
    // This avoids Vercel's Chromium limitation while providing better font/layout support
    window.print()
  }, [])

  const isReadyForPrint =
    !loading && !!invoice && projectReady && subsidiaryReady && bankReady;

  // Calculate invoice total and derived values
  const invoiceTotal = useMemo(() => {
    if (!invoice?.items) return 0;
    return invoice.items.reduce((sum, item) => {
      const lineTotal = (item.unitPrice || 0) * (item.quantity || 0) - (item.discount || 0);
      return sum + lineTotal;
    }, 0);
  }, [invoice?.items]);

  const totalEnglish = useMemo(() => num2eng(invoiceTotal), [invoiceTotal]);
  const totalChinese = useMemo(() => num2chi(invoiceTotal), [invoiceTotal]);

  // Extract client representative name for cheque signature
  const clientRepresentative = useMemo(() => {
    return representativeNameOnly(invoice?.representative) ?? undefined;
  }, [invoice?.representative]);

  // Build FPS QR code URL
  const qrCodeUrl = useMemo(() => {
    const fpsProxy = bankInfo?.fpsId || bankInfo?.fpsEmail || null;
    const payload = buildHKFPSPayload(
      fpsProxy,
      false, // Don't include amount in QR
      null,
      invoice?.invoiceNumber ? `#${invoice.invoiceNumber}` : null
    );
    return buildHKFPSQrUrl(payload, 220);
  }, [bankInfo, invoice?.invoiceNumber]);

  // Map bankInfo to BankInfo type expected by Invoice component
  const invoiceBankInfo: BankInfo = useMemo(() => ({
    bankName: bankInfo?.bankName ?? '',
    bankCode: bankInfo?.bankCode ?? '',
    accountNumber: bankInfo?.accountNumber ?? '',
    fpsId: bankInfo?.fpsId,
    fpsEmail: bankInfo?.fpsEmail,
  }), [bankInfo]);

  // When everything this page needs for bindings is ready, log a concise
  // snapshot so that the headless Chromium run (via the PDF API) can surface
  // what data it actually sees at print time.
  useEffect(() => {
    if (!isReadyForPrint || !invoice) return;
    // eslint-disable-next-line no-console
    console.log('[invoice-preview][ready]', {
      invoiceNumber: invoice.invoiceNumber,
      payTo: invoice.payTo ?? '(not set)',
      hasProject: !!project,
      hasSubsidiary: !!subsidiary,
      hasBankInfo: !!bankInfo,
      bankInfoDetails: bankInfo ? {
        bankName: bankInfo.bankName || '(empty)',
        bankCode: bankInfo.bankCode || '(empty)',
        accountNumber: bankInfo.accountNumber || '(empty)',
        fpsId: bankInfo.fpsId || '(not set)',
        fpsEmail: bankInfo.fpsEmail || '(not set)',
      } : null,
      clientCompanyName: invoice.companyName,
      subsidiaryEnglishName: subsidiary?.englishName ?? null,
      subsidiaryChineseName: subsidiary?.chineseName ?? null,
      invoiceVariant,
      qrCodeGenerated: !!qrCodeUrl,
      isPdfPreview,
      showGridOverlay,
    });
  }, [isReadyForPrint, invoice, project, subsidiary, bankInfo, isPdfPreview, showGridOverlay, invoiceVariant, qrCodeUrl]);

  return (
    <AppShell
      dataProvider={projectsDataProvider}
      resources={[
        { name: 'dashboard', list: '/dashboard', meta: { label: 'Dashboard' } },
        { name: 'client-directory', list: '/client-accounts', meta: { label: 'Client Accounts' } },
        { name: 'projects', list: '/projects', meta: { label: 'Projects' } },
        { name: 'bank', list: '/bank', meta: { label: 'Bank Access' } },
        { name: 'accounting', list: '/accounting', meta: { label: 'Accounting' } },
      ]}
      allowedMenuKeys={['dashboard', 'client-directory', 'projects', 'bank', 'accounting']}
    >
      <div className="preview-page">
        <Head><title>{pageTitle}</title></Head>
        <div className="preview-inner">
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
            <Space>
              <Button onClick={onBack}>&larr; Back to {projectNumber || 'Project'}</Button>
              <Title level={4} style={{ margin: 0 }}>Preview — #{invoiceNumber}</Title>
              <Space size={4} style={{ marginLeft: 12 }}>
                <Text type="secondary">Variant</Text>
                <Select
                  value={invoiceVariant}
                  onChange={setInvoiceVariant}
                  size="small"
                  style={{ width: 90 }}
                  options={[
                    { label: "B (Basic)", value: "B" },
                    { label: "B2", value: "B2" },
                    { label: "A", value: "A" },
                    { label: "A2", value: "A2" },
                  ]}
                />
              </Space>
              <Space size={4} style={{ marginLeft: 12 }}>
                <Text type="secondary">Grid</Text>
                <Switch size="small" checked={showGridOverlay} onChange={setShowGridOverlay} />
              </Space>
              <Space size={4} style={{ marginLeft: 12 }}>
                <Text type="secondary">Flex</Text>
                <Switch size="small" checked={showFlexDebug} onChange={setShowFlexDebug} />
              </Space>
            </Space>
            <Space>
              <Button type="primary" onClick={onExportPdf}>
                Export PDF
              </Button>
            </Space>
          </Space>

          <div className="viewer-wrap">
            {loading ? (
              <Spin size="large" />
            ) : !invoice ? (
              <Empty description="Invoice not found" />
            ) : (
              <div
                className="html-invoice"
                id="invoice-print-root"
                data-ready={isReadyForPrint ? '1' : '0'}
              >
                {/* Invoice Renderer (React component-based) */}
                {isReadyForPrint && subsidiary && (
                  <Invoice
                    invoice={invoice}
                    project={project}
                    subsidiary={subsidiary}
                    bankInfo={invoiceBankInfo}
                    variant={invoiceVariant}
                    totalEnglish={totalEnglish}
                    totalChinese={totalChinese}
                    clientRepresentative={clientRepresentative}
                    qrCodeUrl={qrCodeUrl ?? undefined}
                    debug={showGridOverlay}
                    flexDebug={showFlexDebug}
                  />
                )}

                {!isReadyForPrint && (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">Loading invoice data...</Text>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <style jsx>{`
          .preview-page { padding: 16px; }
          .preview-inner { max-width: 1200px; margin: 0 auto; }
          .viewer-wrap { min-height: 85vh; border: 1px solid #e5e7eb; border-radius: 6px; overflow: auto; background: #fff; display: flex; justify-content: center; align-items: flex-start; padding: 16px; }
          .html-invoice { width: 100%; display: flex; justify-content: center; }
        `}</style>
        {/* Print-specific CSS so that the headless Chromium export only captures
            the invoice content and not the surrounding app chrome (sider,
            top header, etc.). */}
        <style jsx global>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 0.2in 0.3in;
            }

            /* Reset body and html for print */
            html, body {
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Hide app shell elements completely */
            .ant-layout-sider,
            .ant-layout-header,
            nav,
            aside,
            header:not(.invoice-header) {
              display: none !important;
            }

            /* Reset all ancestor containers to remove margins/padding */
            body,
            #__next,
            #__next > *,
            .ant-layout,
            .ant-layout-content,
            .preview-page,
            .preview-inner {
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              background: white !important;
            }

            /* Hide non-invoice UI elements */
            .preview-page > .preview-inner > :not(.viewer-wrap) {
              display: none !important;
            }

            /* Reset viewer wrap for print */
            .viewer-wrap {
              display: block !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              min-height: auto !important;
              background: white !important;
            }

            .html-invoice {
              display: block !important;
              width: auto !important;
            }

            /* Invoice container - allow natural flow */
            .invoice-container {
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            /* CRITICAL: Each invoice-page div is one printed page.
               Allow natural document flow for multi-page printing. */
            .invoice-container .invoice-page {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: always !important;
              break-after: page !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }

            .invoice-container .invoice-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }
        `}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&family=Roboto+Mono:wght@400;700&family=Cormorant+Infant:wght@400;700&family=EB+Garamond:wght@400;700&family=Rampart+One&family=Fascinate&family=Iansui&family=Yuji+Mai&family=Federo&family=Nanum+Pen+Script&family=Covered+By+Your+Grace&family=Chocolate+Classical+Sans&family=Yomogi&family=Ephesis&family=Bungee+Shade&display=swap"
          rel="stylesheet"
        />
      </div>
    </AppShell>
  )
}
export async function getServerSideProps(context: any) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
    },
  };
}
