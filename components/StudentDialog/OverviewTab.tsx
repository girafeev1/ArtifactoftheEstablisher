// components/StudentDialog/OverviewTab.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Tabs, Typography } from 'antd'
import LoadingDash from '../LoadingDash'
import FloatingWindow from './FloatingWindow'
import { titleFor, MainTab, BillingSubTab } from './title'

const { Text, Title } = Typography

// OverviewTab acts purely as a presenter. PersonalTab, SessionsTab and
// BillingTab each fetch and compute their own data then "stream" summary
// values upward via callbacks. This "stream-from-owner" architecture keeps a
// single source of truth in the owning tab, avoids duplicated logic and ensures
// OverviewTab never queries Firestore directly.
import PersonalTab from './PersonalTab'
import BillingTab from './BillingTab'
import RetainersTab from './RetainersTab'
import VouchersTab from './VouchersTab'
import SessionsTab from './SessionsTab'
import PaymentHistory from './PaymentHistory'

console.log('=== StudentDialog loaded version 1.1 ===')

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

class StudentDialogErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('StudentDialog render error', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16 }}>
          <Text type="danger">Student dialog failed to load.</Text>
        </div>
      )
    }
    return this.props.children
  }
}

export interface OverviewTabProps {
  abbr: string
  account: string
  open: boolean
  onClose: () => void
  serviceMode: boolean
  onPopDetail?: (s: any) => void
}

export default function OverviewTab({
  abbr,
  account,
  open,
  onClose,
  serviceMode,
  onPopDetail,
}: OverviewTabProps) {
  console.log('OverviewTab rendered for', abbr)
  const [tab, setTab] = useState<MainTab>('overview')
  const [subTab, setSubTab] = useState<BillingSubTab>(null)
  const [title, setTitle] = useState(titleFor('overview', null, account))
  const titleLocked = useRef(false)
  const setChildTitle = useCallback(
    (t: string | null) => {
      titleLocked.current = t != null
      if (t) setTitle(t)
      else setTitle(titleFor(tab, subTab, account))
    },
    [tab, subTab, account],
  )
  const [actions, setActions] = useState<React.ReactNode | null>(null)

  // personal summary streamed from PersonalTab
  const [personal, setPersonal] = useState<any>({})
  const [personalLoading, setPersonalLoading] = useState({
    firstName: true,
    lastName: true,
    sex: true,
  })

  // billing summary streamed from BillingTab
  const [billing, setBilling] = useState<any>({})
  const [billingLoading, setBillingLoading] = useState({
    balanceDue: true,
    voucherBalance: true,
  })

  // overview summary streamed from SessionsTab
  const [overview, setOverview] = useState<any>({
    joint: '',
    last: '',
    total: 0,
    proceeded: 0,
    cancelled: 0,
  })
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [hover, setHover] = useState(false)

  const handlePersonal = useCallback(
    (data: Partial<{ firstName: string; lastName: string; sex: string }>) => {
      setPersonal((p: any) => ({ ...p, ...data }))
      Object.keys(data).forEach((k) =>
        setPersonalLoading((l: any) => ({ ...l, [k]: false }))
      )
    },
    [setPersonal, setPersonalLoading],
  )

  const handleBilling = useCallback(
    (data: Partial<{ balanceDue: number; voucherBalance: number }>) => {
      setBilling((b: any) => ({ ...b, ...data }))
      Object.keys(data).forEach((k) =>
        setBillingLoading((l: any) => ({ ...l, [k]: false }))
      )
    },
    [setBilling, setBillingLoading],
  )

  const handleSummary = useCallback(
    (s: {
      jointDate: string
      lastSession: string
      totalSessions: number
      proceeded: number
      cancelled: number
    }) => {
      setOverview({
        joint: s.jointDate,
        last: s.lastSession,
        total: s.totalSessions,
        proceeded: s.proceeded,
        cancelled: s.cancelled,
      })
      setOverviewLoading(false)
    },
    [setOverview, setOverviewLoading],
  )

  const selectTab = (v: string) => {
    if (v.startsWith('billing-')) {
      setTab('billing')
      const sub = v.replace(/^billing-/, '') as BillingSubTab
      setSubTab(sub || null)
      if (!titleLocked.current) setTitle(titleFor('billing', sub || null, account))
    } else {
      const mt = v as MainTab
      setTab(mt)
      setSubTab(null)
      if (!titleLocked.current) setTitle(titleFor(mt, null, account))
    }
  }

  const handleTabChange = (v: string) => selectTab(v)

  const closeAndReset = () => {
    setTab('overview')
    setSubTab(null)
    titleLocked.current = false
    setTitle(titleFor('overview', null, account))
    onClose()
  }

  // reset loading states whenever dialog is opened
  useEffect(() => {
    console.log('OverviewTab reset effect for', abbr)
    if (open) {
      setPersonal({})
      setBilling({})
      setOverview({ joint: '', last: '', total: 0 })
      setPersonalLoading({ firstName: true, lastName: true, sex: true })
      setBillingLoading({ balanceDue: true, voucherBalance: true })
      setOverviewLoading(true)
      setActions(null)
      setTab('overview')
      setSubTab(null)
      titleLocked.current = false
      setTitle(titleFor('overview', null, account))
    }
  }, [open, abbr, account])

  useEffect(() => {
    if (!titleLocked.current) setTitle(titleFor(tab, subTab, account))
  }, [tab, subTab, account])

  useEffect(() => {
    console.log('OverviewTab loading states', {
      personalLoading,
      billingLoading,
      overviewLoading,
    })
  })

  const displayField = (v: any) => {
    if (v === '__ERROR__') return 'Error'
    if (v === undefined || v === null || v === '') return 'N/A'
    return String(v)
  }

  // We no longer block the entire dialog with an overlay.
  // Each field shows its own inline spinner while loading.
  const loading = false

  const selected =
    tab === 'billing' && subTab ? `billing-${subTab}` : tab

  const labelStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 200 }
  const valueStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500, margin: 0 }

  const tabItems = [
    { key: 'overview', label: 'Overview' },
    { key: 'personal', label: 'Personal' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'billing', label: 'Billing' },
    ...(tab === 'billing' ? [
      { key: 'billing-retainers', label: <span style={{ paddingLeft: 16, fontSize: '0.82rem' }}>Retainers</span> },
      { key: 'billing-payment-history', label: <span style={{ paddingLeft: 16, fontSize: '0.82rem' }}>Payment History</span> },
      { key: 'billing-session-vouchers', label: <span style={{ paddingLeft: 16, fontSize: '0.82rem' }}>Session Vouchers</span> },
    ] : []),
  ]

  if (!open) return null
  return (
    <StudentDialogErrorBoundary>
      <FloatingWindow onClose={closeAndReset} title={title} actions={actions}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxHeight: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexGrow: 1, position: 'relative', alignItems: 'flex-start', maxHeight: '100%', maxWidth: '100%' }}>
            {/* No blocking overlay. Show inline spinners per-field below. */}

            <div
              style={{
                flexGrow: 1,
                paddingRight: 24,
                overflow: 'auto',
                textAlign: 'left',
                maxHeight: '100%',
                maxWidth: '100%',
              }}
            >
              <div style={{ display: tab === 'overview' ? 'block' : 'none' }}>
                <Text type="secondary" style={labelStyle}>
                  Legal Name:
                </Text>
                <Title level={5} style={valueStyle}>
                  {(personalLoading.firstName || personalLoading.lastName)
                    ? <LoadingDash />
                    : (() => {
                        const first = displayField(personal.firstName)
                        const last = displayField(personal.lastName)
                        const both = `${first} ${last}`.trim()
                        return both === 'N/A N/A' ? 'N/A' : both
                      })()}
                </Title>

                <Text type="secondary" style={labelStyle}>
                  Gender:
                </Text>
                <Title level={5} style={valueStyle}>
                  {personalLoading.sex ? <LoadingDash /> : displayField(personal.sex)}
                </Title>

                <Text type="secondary" style={labelStyle}>
                  Joined Date:
                </Text>
                {overviewLoading ? (
                  <Title level={5} style={valueStyle}>
                    <LoadingDash />
                  </Title>
                ) : (
                  <Title level={5} style={valueStyle}>
                    {overview.joint || '–'}
                  </Title>
                )}

                <div>
                  <Text type="secondary" style={labelStyle}>
                    Total Sessions:
                  </Text>
                  {overviewLoading ? (
                    <Title level={5} style={valueStyle}>
                      <LoadingDash />
                    </Title>
                  ) : (
                    <Title
                      level={5}
                      style={valueStyle}
                      onMouseEnter={() => setHover(true)}
                      onMouseLeave={() => setHover(false)}
                    >
                      {hover
                        ? `✔︎ ${overview.proceeded ?? 0}`
                        : `${overview.total ?? '–'} (❌ ${overview.cancelled ?? '–'})`}
                    </Title>
                  )}
                </div>

                <Text type="secondary" style={labelStyle}>
                  Balance Due:
                </Text>
                {billingLoading.balanceDue ? (
                  <Title level={5} style={valueStyle}>
                    <LoadingDash />
                  </Title>
                ) : (
                  <Title level={5} style={valueStyle}>
                    {billing.balanceDue != null
                      ? formatCurrency(Number(billing.balanceDue) || 0)
                      : '-'}
                  </Title>
                )}

                <Text type="secondary" style={labelStyle}>
                  Voucher Balance:
                </Text>
                {billingLoading.voucherBalance ? (
                  <Title level={5} style={valueStyle}>
                    <LoadingDash />
                  </Title>
                ) : (
                  <Title level={5} style={valueStyle}>
                    {billing.voucherBalance != null
                      ? Number(billing.voucherBalance)
                      : '-'}
                  </Title>
                )}
              </div>

              <PersonalTab
                abbr={abbr}
                serviceMode={serviceMode}
                onPersonal={handlePersonal}
                style={{ display: tab === 'personal' ? 'block' : 'none' }}
              />

              <SessionsTab
                abbr={abbr}
                account={account}
                onSummary={handleSummary}
                onTitle={setTitle}
                onActions={setActions}
                onPopDetail={onPopDetail}
                style={{ display: tab === 'sessions' ? 'block' : 'none' }}
              />

              <BillingTab
                abbr={abbr}
                account={account}
                serviceMode={serviceMode}
                onBilling={handleBilling}
                style={{
                  display:
                    tab === 'billing' && !subTab ? 'block' : 'none',
                }}
              />
              <div
                style={{
                  display:
                    tab === 'billing' && subTab === 'retainers'
                      ? 'block'
                      : 'none',
                }}
              >
                <RetainersTab
                  abbr={abbr}
                  account={account}
                  balanceDue={Number(billing.balanceDue) || 0}
                />
              </div>
              <div
                style={{
                  display:
                    tab === 'billing' && subTab === 'payment-history'
                      ? 'block'
                      : 'none',
                }}
              >
                <PaymentHistory
                  abbr={abbr}
                  account={account}
                  onTitleChange={setChildTitle}
                  active={tab === 'billing' && subTab === 'payment-history'}
                />
              </div>
              <div
                style={{
                  display:
                    tab === 'billing' && subTab === 'session-vouchers'
                      ? 'block'
                      : 'none',
                }}
              >
                <VouchersTab abbr={abbr} account={account} />
              </div>
            </div>

            <Tabs
              tabPosition="right"
              activeKey={selected}
              onChange={handleTabChange}
              items={tabItems}
              style={{
                borderLeft: '1px solid #f0f0f0',
                minWidth: 140,
              }}
            />
          </div>
        </div>
      </FloatingWindow>
    </StudentDialogErrorBoundary>
  )
}
