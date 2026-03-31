'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { CARD_TYPES } from '@/lib/ev/cardRules'

const TIMEZONE = 'Asia/Seoul'

export interface EvTransaction {
  id: string
  date: string
  provider: string
  card_type: string
  amount: number
  is_discounted: boolean
  source: string
  raw_id: string
}

export interface EvCardStatus {
  card_type: string
  last_performance: number
  current_spend: number
  remaining_limit: number
  updated_at: string
}

export interface MonthlyProviderTotal {
  yearMonth: string
  provider: string
  total: number
}

export async function getEvTransactions(
  yearMonth?: string,
): Promise<EvTransaction[]> {
  const now = toZonedTime(new Date(), TIMEZONE)
  const targetMonth = yearMonth ?? format(now, 'yyyy-MM')
  const [year, month] = targetMonth.split('-').map(Number)

  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(new Date(year, month - 1))

  const { data, error } = await supabaseAdmin
    .from('ev_transactions')
    .select('id, date, provider, card_type, amount, is_discounted, source, raw_id')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString())
    .order('date', { ascending: false })

  if (error) {
    console.error('[EV Actions] getEvTransactions error:', error)
    return []
  }
  return data ?? []
}

export async function getEvCardStatuses(): Promise<EvCardStatus[]> {
  const { data, error } = await supabaseAdmin
    .from('ev_card_status')
    .select('card_type, last_performance, current_spend, remaining_limit, updated_at')
    .in('card_type', CARD_TYPES)

  if (error) {
    console.error('[EV Actions] getEvCardStatuses error:', error)
    return []
  }
  return data ?? []
}

export async function getMonthlyProviderTotals(monthsBack = 6): Promise<MonthlyProviderTotal[]> {
  const now = toZonedTime(new Date(), TIMEZONE)
  const since = startOfMonth(subMonths(now, monthsBack - 1))

  const { data, error } = await supabaseAdmin
    .from('ev_transactions')
    .select('date, provider, amount')
    .gte('date', since.toISOString())
    .order('date', { ascending: true })

  if (error) {
    console.error('[EV Actions] getMonthlyProviderTotals error:', error)
    return []
  }

  const totalsMap = new Map<string, number>()
  for (const tx of data ?? []) {
    const key = `${format(new Date(tx.date), 'yyyy-MM')}__${tx.provider}`
    totalsMap.set(key, (totalsMap.get(key) ?? 0) + tx.amount)
  }

  return Array.from(totalsMap.entries()).map(([key, total]) => {
    const [yearMonth, provider] = key.split('__')
    return { yearMonth, provider, total }
  })
}

export async function getLastSyncedAt(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('ev_card_status')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return data?.updated_at ?? null
}
