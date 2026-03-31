import type { Metadata } from 'next'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { getEvTransactions, getEvCardStatuses, getMonthlyProviderTotals, getLastSyncedAt } from './actions'
import EVDashboard from './EVDashboard'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'EV 충전 대시보드 | SC 주차 관리',
  description: '신한카드 EV, BC 어디로든 그린카드 V3 충전 내역 및 혜택 현황',
}

export default async function EVPage() {
  const TIMEZONE = 'Asia/Seoul'
  const now = toZonedTime(new Date(), TIMEZONE)
  const currentYearMonth = format(now, 'yyyy-MM')

  const [transactions, cardStatuses, monthlyTotals, lastSyncedAt] = await Promise.all([
    getEvTransactions(currentYearMonth),
    getEvCardStatuses(),
    getMonthlyProviderTotals(6),
    getLastSyncedAt(),
  ])

  return (
    <EVDashboard
      transactions={transactions}
      cardStatuses={cardStatuses}
      monthlyTotals={monthlyTotals}
      lastSyncedAt={lastSyncedAt}
      currentYearMonth={currentYearMonth}
    />
  )
}
