export type MainTab = 'overview' | 'personal' | 'sessions' | 'billing'
export type BillingSubTab = 'retainers' | 'payment-history' | 'session-vouchers' | null

export const titleFor = (
  tab: MainTab,
  subTab: BillingSubTab,
  account: string,
  extra?: string,
): string => {
  const tabMap: Record<MainTab, string> = {
    overview: 'Overview',
    personal: 'Personal',
    sessions: 'Sessions',
    billing: 'Billing',
  }
  let title = `${account} - ${tabMap[tab]}`
  if (tab === 'billing' && subTab) {
    const subMap: Record<Exclude<BillingSubTab, null>, string> = {
      retainers: 'Retainers',
      'payment-history': 'Payment History',
      'session-vouchers': 'Session Vouchers',
    }
    title = `${account} - Billing - ${subMap[subTab]}`
  }
  if (extra) title += ` | ${extra}`
  return title
}
