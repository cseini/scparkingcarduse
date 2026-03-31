'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CARD_RULES, CARD_TYPES, CardType, getActiveTier } from '@/lib/ev/cardRules'
import type { EvTransaction, EvCardStatus, MonthlyProviderTotal } from './actions'

/* ─── 타입 ─────────────────────────────────── */
interface Props {
  transactions: EvTransaction[]
  cardStatuses: EvCardStatus[]
  monthlyTotals: MonthlyProviderTotal[]
  lastSyncedAt: string | null
  currentYearMonth: string
}

/* ─── 색상 ─────────────────────────────────── */
const PROVIDER_COLORS: Record<string, string> = {
  '환경부': '#2563eb',
  '투루차저': '#10b981',
  '차지비': '#f59e0b',
}

const CARD_COLORS: Record<CardType, string> = {
  Shinhan_EV: '#e74c3c',
  BC_Green_V3: '#27ae60',
}

/* ─── 유틸 ─────────────────────────────────── */
function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'yyyy.MM.dd HH:mm')
  } catch {
    return dateStr
  }
}

/* ─── 진행바 컴포넌트 ─────────────────────── */
function ProgressBar({ used, max, color }: { used: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0
  return (
    <div style={{ background: 'var(--border)', borderRadius: '1rem', height: '8px', overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: color,
        borderRadius: '1rem',
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

/* ─── 막대 차트 (CSS 기반) ─────────────────── */
function BarChart({ totals }: { totals: MonthlyProviderTotal[] }) {
  const months = [...new Set(totals.map((t) => t.yearMonth))].sort()
  const providers = [...new Set(totals.map((t) => t.provider))]
  const maxValue = Math.max(...totals.map((t) => t.total), 1)

  if (months.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>데이터 없음</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '0.5rem', minWidth: `${months.length * 100}px`, alignItems: 'flex-end', height: '160px', padding: '0 0.5rem' }}>
        {months.map((ym) => {
          const monthTotals = totals.filter((t) => t.yearMonth === ym)
          return (
            <div key={ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: '80px' }}>
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '120px', width: '100%', justifyContent: 'center' }}>
                {providers.map((prov) => {
                  const entry = monthTotals.find((t) => t.provider === prov)
                  const val = entry?.total ?? 0
                  const barHeight = val > 0 ? Math.max(4, Math.round((val / maxValue) * 110)) : 0
                  return (
                    <div
                      key={prov}
                      title={`${prov}: ${formatKRW(val)}`}
                      style={{
                        width: '18px',
                        height: `${barHeight}px`,
                        background: PROVIDER_COLORS[prov] ?? '#94a3b8',
                        borderRadius: '3px 3px 0 0',
                        flexShrink: 0,
                        alignSelf: 'flex-end',
                        transition: 'height 0.3s ease',
                      }}
                    />
                  )
                })}
              </div>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>{ym.slice(2)}</span>
            </div>
          )
        })}
      </div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {providers.map((prov) => (
          <div key={prov} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: PROVIDER_COLORS[prov] ?? '#94a3b8' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{prov}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── 카드 요약 컴포넌트 ─────────────────── */
function CardSummary({ status }: { status: EvCardStatus }) {
  const cardType = status.card_type as CardType
  const rule = CARD_RULES[cardType]
  if (!rule) return null

  const tier = getActiveTier(cardType, status.last_performance)
  const usedLimit = Math.max(0, (tier?.monthlyLimitWon ?? 20_000) - status.remaining_limit)
  const maxLimit = tier?.monthlyLimitWon ?? 20_000
  const tierLabel = tier
    ? `${(tier.rate * 100).toFixed(0)}% ${rule.benefitType === 'discount' ? '청구할인' : '에코머니'} (${(tier.minPerformance / 10000).toFixed(0)}만원 이상)`
    : '실적 부족 (30만원 미만)'

  const color = CARD_COLORS[cardType] ?? 'var(--primary)'
  const benefitLabel = rule.benefitType === 'discount' ? '할인' : '에코머니 포인트'

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: '1rem',
      padding: '1.25rem',
      flex: 1,
      minWidth: '280px',
      boxShadow: 'var(--shadow)',
    }}>
      {/* 카드 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-strong)' }}>{rule.displayName}</span>
      </div>

      {/* 전월 실적 구간 */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>전월 실적 구간</span>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: tier ? color : 'var(--text-muted)', marginTop: '0.2rem' }}>
          {tierLabel}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          전월 실적: {formatKRW(status.last_performance)}
        </div>
      </div>

      {/* 당월 충전 합계 */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>당월 충전 합계</span>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-strong)', marginTop: '0.2rem' }}>
          {formatKRW(status.current_spend)}
        </div>
      </div>

      {/* 남은 혜택 한도 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>남은 {benefitLabel} 한도</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: color }}>
            {formatKRW(status.remaining_limit)} / {formatKRW(maxLimit)}
          </span>
        </div>
        <ProgressBar used={usedLimit} max={maxLimit} color={color} />
        {usedLimit > 0 && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', textAlign: 'right' }}>
            이미 사용: {formatKRW(usedLimit)}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 메인 대시보드 ─────────────────────── */
export default function EVDashboard({
  transactions: initialTransactions,
  cardStatuses: initialStatuses,
  monthlyTotals,
  lastSyncedAt,
  currentYearMonth,
}: Props) {
  const router = useRouter()
  const [isSyncing, startSync] = useTransition()
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [transactions, setTransactions] = useState<EvTransaction[]>(initialTransactions)
  const [cardStatuses, setCardStatuses] = useState<EvCardStatus[]>(initialStatuses)
  const [filterCard, setFilterCard] = useState<string>('all')
  const [filterProvider, setFilterProvider] = useState<string>('all')

  const handleSync = useCallback(() => {
    startSync(async () => {
      setSyncMsg(null)
      try {
        const res = await fetch('/api/ev/sync', { method: 'POST' })
        const data = await res.json()
        if (data.success || (data.emailTransactions + data.scraperTransactions) >= 0) {
          setSyncMsg({
            type: 'success',
            text: `동기화 완료 — 이메일: ${data.emailTransactions}건, 스크래퍼: ${data.scraperTransactions}건${data.errors?.length ? ` (경고: ${data.errors.length}건)` : ''}`,
          })
          // Refresh server data without a full page reload
          router.refresh()
        } else {
          setSyncMsg({ type: 'error', text: `동기화 실패: ${data.errors?.join(', ') ?? '알 수 없는 오류'}` })
        }
      } catch (err) {
        setSyncMsg({ type: 'error', text: `동기화 오류: ${String(err)}` })
      }
    })
  }, [])

  const filteredTx = transactions.filter((tx) => {
    if (filterCard !== 'all' && tx.card_type !== filterCard) return false
    if (filterProvider !== 'all' && tx.provider !== filterProvider) return false
    return true
  })

  const totalAmount = filteredTx.reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <div className="container" style={{ paddingTop: '1rem', paddingBottom: '3rem' }}>
      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-strong)', margin: 0 }}>⚡ EV 충전 대시보드</h1>
          {lastSyncedAt && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              마지막 동기화: {formatDate(lastSyncedAt)}
            </p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          style={{
            background: isSyncing ? 'var(--secondary)' : 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.6rem',
            padding: '0.5rem 1rem',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          {isSyncing ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> 동기화 중...
            </>
          ) : '🔄 지금 동기화'}
        </button>
      </div>

      {/* ── 동기화 메시지 ── */}
      {syncMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.6rem',
          marginBottom: '1rem',
          background: syncMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: syncMsg.type === 'success' ? '#059669' : '#dc2626',
          border: `1px solid ${syncMsg.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
          fontSize: '0.8rem',
          fontWeight: 600,
        }}>
          {syncMsg.text}
        </div>
      )}

      {/* ── 카드 요약 ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          카드별 현황 ({currentYearMonth})
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {CARD_TYPES.map((ct) => {
            const status = cardStatuses.find((s) => s.card_type === ct)
            if (!status) {
              return (
                <div key={ct} style={{
                  background: 'var(--card-bg)',
                  border: '1px dashed var(--border)',
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  flex: 1,
                  minWidth: '280px',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 700 }}>{CARD_RULES[ct].displayName}</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>데이터 없음 — 동기화 실행 후 확인하세요</div>
                </div>
              )
            }
            return <CardSummary key={ct} status={status} />
          })}
        </div>
      </section>

      {/* ── 월별/업체별 차트 ── */}
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow)' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
          월별 충전 금액 (최근 6개월)
        </h2>
        <BarChart totals={monthlyTotals} />
      </section>

      {/* ── 이용내역 테이블 ── */}
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.25rem', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            이용내역 ({currentYearMonth})
          </h2>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)' }}>
            합계: {formatKRW(totalAmount)} ({filteredTx.length}건)
          </span>
        </div>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={filterCard}
            onChange={(e) => setFilterCard(e.target.value)}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }}
          >
            <option value="all">전체 카드</option>
            {CARD_TYPES.map((ct) => <option key={ct} value={ct}>{CARD_RULES[ct].displayName}</option>)}
          </select>
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }}
          >
            <option value="all">전체 업체</option>
            {['환경부', '투루차저', '차지비'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {filteredTx.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
            이용내역 없음
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['날짜', '업체', '카드', '금액', '수집 방법'].map((h) => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((tx, i) => (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--item-bg)',
                    }}
                  >
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {formatDate(tx.date)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '0.3rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: PROVIDER_COLORS[tx.provider] ? `${PROVIDER_COLORS[tx.provider]}20` : 'var(--item-bg)',
                        color: PROVIDER_COLORS[tx.provider] ?? 'var(--text-strong)',
                        border: `1px solid ${PROVIDER_COLORS[tx.provider] ?? 'var(--border)'}40`,
                      }}>
                        {tx.provider}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '0.3rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: `${CARD_COLORS[tx.card_type as CardType] ?? '#94a3b8'}20`,
                        color: CARD_COLORS[tx.card_type as CardType] ?? 'var(--text-muted)',
                        border: `1px solid ${CARD_COLORS[tx.card_type as CardType] ?? '#94a3b8'}40`,
                      }}>
                        {CARD_RULES[tx.card_type as CardType]?.displayName ?? tx.card_type}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-strong)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatKRW(tx.amount)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>
                      {tx.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
