import Head from "next/head";
import { useRouter } from "next/router";
import { Button, Space, Typography, Empty, Spin, Switch } from "antd";
import React, { useEffect, useState } from "react";
import AppShell from "../../../../../../../../components/new-ui/AppShell";
import { projectsDataProvider } from "../../../../../../../../components/projects/NewUIProjectsApp";
import GeneratedInvoice from "../../../../../../../../components/projects/GeneratedInvoice";
import type { ProjectInvoiceRecord } from "../../../../../../../../lib/projectInvoices";
import type { ProjectRecord } from "../../../../../../../../lib/projectsDatabase";
import { fetchSubsidiaryById, type SubsidiaryDoc } from "../../../../../../../../lib/subsidiaries";
import { resolveBankAccountIdentifier } from "../../../../../../../../lib/erlDirectory";
import { getAuthOptions } from "../../../../../../../../pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";

const { Title, Text } = Typography;

export default function InvoicePreviewPage() {
  const router = useRouter();
  const { projectId, invoiceNumber } = router.query as { projectId?: string; invoiceNumber?: string };
  const year = (router.query.year as string) || '';
  const [invoice, setInvoice] = useState<ProjectInvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingScheme, setUsingScheme] = useState<boolean>(false);
  const [scheme, setScheme] = useState<any | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [subsidiary, setSubsidiary] = useState<SubsidiaryDoc | null>(null);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [bankInfo, setBankInfo] = useState<any | null>(null);
  const [projectReady, setProjectReady] = useState(false);
  const [subsidiaryReady, setSubsidiaryReady] = useState(false);
  const [bankReady, setBankReady] = useState(false);

  const projectNumber = (router.query.projectNumber as string) || '';
  const isPdfPreview = router.query.pdf === '1' || router.query.pdf === 'true';

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

  useEffect(() => {
    if (!year || !projectId || !invoiceNumber) return;
    setLoading(true);
    fetch(`/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(projectId)}/${encodeURIComponent(invoiceNumber)}`)
      .then(res => res.json())
      .then(data => {
        setInvoice(data.invoice);
        setUsingScheme(Boolean(data.usingScheme));
        setScheme(data.scheme ?? null);
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

  // Resolve bank info from the invoice's paidTo identifier so we can bind
  // BankName/BankCode/account number tokens for the Instruction sheet.
  useEffect(() => {
    setBankReady(false);
    const run = async () => {
      if (!invoice?.paidTo) {
        setBankInfo(null);
         setBankReady(true);
        return;
      }
      try {
        const info = await resolveBankAccountIdentifier(invoice.paidTo);
        setBankInfo(info);
      } catch {
        setBankInfo(null);
      } finally {
        setBankReady(true);
      }
    };
    void run();
  }, [invoice?.paidTo]);

  const onBack = React.useCallback(() => {
    if (projectId) router.push(`/dashboard/new-ui/projects/show/${encodeURIComponent(projectId)}`)
  }, [router, projectId])

  const onExportPdf = React.useCallback(() => {
    if (!year || !projectId || !invoiceNumber) return
    const url = `/api/invoices/${encodeURIComponent(year)}/${encodeURIComponent(
      projectId as string,
    )}/${encodeURIComponent(invoiceNumber as string)}/pdf?projectNumber=${encodeURIComponent(
      (projectNumber as string) || '',
    )}${showGridOverlay ? '&grid=1' : ''}`
    window.open(url, '_blank')
  }, [year, projectId, invoiceNumber, projectNumber, showGridOverlay])

  const isReadyForPrint =
    !loading && !!invoice && projectReady && subsidiaryReady && bankReady;

  // When everything this page needs for bindings is ready, log a concise
  // snapshot so that the headless Chromium run (via the PDF API) can surface
  // what data it actually sees at print time.
  useEffect(() => {
    if (!isReadyForPrint || !invoice) return;
    // eslint-disable-next-line no-console
    console.log('[invoice-preview][ready]', {
      invoiceNumber: invoice.invoiceNumber,
      hasProject: !!project,
      hasSubsidiary: !!subsidiary,
      hasBankInfo: !!bankInfo,
      clientCompanyName: invoice.companyName,
      subsidiaryEnglishName: subsidiary?.englishName ?? null,
      subsidiaryChineseName: subsidiary?.chineseName ?? null,
      isPdfPreview,
      showGridOverlay,
    });
  }, [isReadyForPrint, invoice, project, subsidiary, bankInfo]);

  return (
    <AppShell
      dataProvider={projectsDataProvider}
      resources={[{ name: 'projects', list: '/dashboard/new-ui/projects', meta: { label: 'Projects' } }]}
      allowedMenuKeys={['projects']}
    >
      <div className="preview-page">
        <Head><title>Invoice Preview · #{invoiceNumber}</title></Head>
        <div className="preview-inner">
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
            <Space>
              <Button onClick={onBack}>&larr; Back to {projectNumber || 'Project'}</Button>
              <Title level={4} style={{ margin: 0 }}>Preview — #{invoiceNumber}</Title>
              {usingScheme ? (
                <>
                  <Text type="secondary" style={{ marginLeft: 8 }}>(With imported schematics)</Text>
                  <Space size={4} style={{ marginLeft: 12 }}>
                    <Text type="secondary">Grid</Text>
                    <Switch size="small" checked={showGridOverlay} onChange={setShowGridOverlay} />
                  </Space>
                </>
              ) : null}
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
                <GeneratedInvoice
                  invoice={invoice}
                  scheme={scheme ?? undefined}
                  project={project ?? undefined}
                  subsidiary={subsidiary ?? undefined}
                  showGridOverlay={showGridOverlay}
                  bankInfo={bankInfo}
                  // Allow the same grid/labels to render in both the interactive
                  // preview and the headless Chromium PDF when ?grid=1 so that
                  // what you see on screen matches the exported PDF.
                  suppressGridLabels={false}
                />
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

            /* Hide everything by default, then reveal only the invoice root.
               This avoids printing the AppShell chrome and preview toolbar. */
            body * {
              visibility: hidden !important;
            }

            #invoice-print-root,
            #invoice-print-root * {
              visibility: visible !important;
            }

            #invoice-print-root {
              position: absolute;
              inset: 0;
              margin: 0 !important;
              padding: 0 !important;
            }

          }
        `}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&family=Roboto+Mono:wght@400;700&family=Cormorant+Infant:wght@400;700&family=EB+Garamond:wght@400;700&family=Rampart+One&family=Fascinate&family=Iansui&family=Yuji+Mai&family=Federo&display=swap"
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
