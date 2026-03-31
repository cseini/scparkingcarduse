/**
 * POST /api/ev/sync
 * 이메일 파서 + 웹 스크래퍼를 순차 실행하여 EV 충전 데이터를 동기화합니다.
 * 중복 방지: raw_id UNIQUE 제약으로 upsert 처리
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parseChargingEmails } from '@/lib/ev/emailParser'
import { scrapeAllCardStatuses, scrapeAllProviderHistory } from '@/lib/ev/scraper'
import { CARD_TYPES } from '@/lib/ev/cardRules'
import { startOfMonth, endOfMonth } from 'date-fns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SyncResult {
  emailTransactions: number
  scraperTransactions: number
  cardStatuses: number
  errors: string[]
}

export async function POST() {
  const result: SyncResult = { emailTransactions: 0, scraperTransactions: 0, cardStatuses: 0, errors: [] }

  // 1. 이메일 파서 실행
  try {
    const emailTxs = await parseChargingEmails(31)
    if (emailTxs.length > 0) {
      const { error } = await supabaseAdmin
        .from('ev_transactions')
        .upsert(
          emailTxs.map((tx) => ({
            id: undefined as unknown as string,   // omit to let DB generate UUID via DEFAULT
            date: tx.date.toISOString(),
            provider: tx.provider,
            card_type: tx.cardType,
            amount: tx.amount,
            is_discounted: true,
            source: tx.source,
            raw_id: tx.rawId,
          })),
          { onConflict: 'raw_id', ignoreDuplicates: true },
        )
      if (error) {
        result.errors.push(`Email upsert: ${error.message}`)
      } else {
        result.emailTransactions = emailTxs.length
      }
    }
  } catch (err) {
    result.errors.push(`Email parser: ${String(err)}`)
  }

  // 2. 충전사 스크래퍼 실행 (카드 타입별)
  for (const cardType of CARD_TYPES) {
    try {
      const scraperTxs = await scrapeAllProviderHistory(cardType)
      if (scraperTxs.length > 0) {
        const { error } = await supabaseAdmin
          .from('ev_transactions')
          .upsert(
            scraperTxs.map((tx) => ({
              id: undefined as unknown as string,   // omit to let DB generate UUID via DEFAULT
              date: tx.date.toISOString(),
              provider: tx.provider,
              card_type: tx.cardType,
              amount: tx.amount,
              is_discounted: true,
              source: tx.source,
              raw_id: tx.rawId,
            })),
            { onConflict: 'raw_id', ignoreDuplicates: true },
          )
        if (error) {
          result.errors.push(`Scraper upsert (${cardType}): ${error.message}`)
        } else {
          result.scraperTransactions += scraperTxs.length
        }
      }
    } catch (err) {
      result.errors.push(`Scraper (${cardType}): ${String(err)}`)
    }
  }

  // 3. 카드사 상태 스크래핑 (전월실적/한도)
  try {
    const statuses = await scrapeAllCardStatuses()
    for (const status of statuses) {
      const now = new Date()
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)

      // 당월 충전 합계 재계산
      const { data: txData } = await supabaseAdmin
        .from('ev_transactions')
        .select('amount')
        .eq('card_type', status.cardType)
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString())

      const currentSpend = (txData ?? []).reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0)

      const { error } = await supabaseAdmin
        .from('ev_card_status')
        .upsert({
          card_type: status.cardType,
          last_performance: status.lastPerformance,
          current_spend: currentSpend,
          remaining_limit: status.remainingLimit,
          updated_at: now.toISOString(),
        }, { onConflict: 'card_type' })

      if (error) {
        result.errors.push(`Card status upsert (${status.cardType}): ${error.message}`)
      } else {
        result.cardStatuses++
      }
    }
  } catch (err) {
    result.errors.push(`Card status scraper: ${String(err)}`)
  }

  // 4. 트랜잭션 기반 당월 집계 업데이트 (스크래퍼 없이 트랜잭션만 있는 카드)
  for (const cardType of CARD_TYPES) {
    try {
      const now = new Date()
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)
      const { data: txData } = await supabaseAdmin
        .from('ev_transactions')
        .select('amount')
        .eq('card_type', cardType)
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString())

      if (!txData) continue

      const currentSpend = txData.reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0)

      // 기존 상태 가져와서 last_performance는 유지, current_spend만 업데이트
      const { data: existing } = await supabaseAdmin
        .from('ev_card_status')
        .select('last_performance, remaining_limit')
        .eq('card_type', cardType)
        .single()

      await supabaseAdmin
        .from('ev_card_status')
        .upsert({
          card_type: cardType,
          last_performance: existing?.last_performance ?? 0,
          current_spend: currentSpend,
          remaining_limit: existing?.remaining_limit ?? 20_000,
          updated_at: now.toISOString(),
        }, { onConflict: 'card_type' })
    } catch {
      // ignore individual card update failures
    }
  }

  return NextResponse.json({
    success: result.errors.length === 0,
    ...result,
  })
}
