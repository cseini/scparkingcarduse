/**
 * POST /api/ev/sync
 * Supabase의 ev_transactions 기반으로 당월 카드 집계를 재계산합니다.
 *
 * ⚠️ Playwright 기반 웹 스크래퍼와 IMAP 이메일 파서는 Node.js 전용 바이너리를
 *    사용하므로 Cloudflare Edge Runtime에서 실행할 수 없습니다.
 *    외부 데이터 수집은 별도의 Node.js 스크립트나 cron 작업을 통해 수행하세요.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CARD_TYPES } from '@/lib/ev/cardRules'
import { startOfMonth, endOfMonth } from 'date-fns'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

interface SyncResult {
  cardStatuses: number
  errors: string[]
}

export async function POST() {
  const result: SyncResult = { cardStatuses: 0, errors: [] }

  // 트랜잭션 기반 당월 집계 업데이트
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

      const { error } = await supabaseAdmin
        .from('ev_card_status')
        .upsert({
          card_type: cardType,
          last_performance: existing?.last_performance ?? 0,
          current_spend: currentSpend,
          remaining_limit: existing?.remaining_limit ?? 20_000,
          updated_at: now.toISOString(),
        }, { onConflict: 'card_type' })

      if (error) {
        result.errors.push(`Card status upsert (${cardType}): ${error.message}`)
      } else {
        result.cardStatuses++
      }
    } catch (err) {
      result.errors.push(`Card status update (${cardType}): ${String(err)}`)
    }
  }

  return NextResponse.json({
    success: result.errors.length === 0,
    ...result,
  })
}
