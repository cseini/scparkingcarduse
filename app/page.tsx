import { supabase } from '@/lib/supabaseClient'
import Calendar from './Calendar'
import { getUsageHistory, getProfiles, getCardPerformance } from './actions'
import { cookies } from 'next/headers'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import PullToRefresh from './PullToRefresh'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function getParkingCards(profileId?: number) {
  if (!profileId) return []

  const { data: cards, error } = await supabase
    .from('parking_cards')
    .select('id, user_name, profile_id, color')
    .eq('profile_id', profileId)
    .order('id', { ascending: true })

  if (error || !cards) {
    console.error('Error fetching parking cards:', error)
    return []
  }

  // 이번 달 사용 횟수를 이력 테이블에서 실시간으로 계산
  const now = toZonedTime(new Date(), 'Asia/Seoul')
  const start = startOfMonth(now).toISOString()
  const end = endOfMonth(now).toISOString()

  const { data: history } = await supabase
    .from('parking_usage_history')
    .select('card_id')
    .gte('used_at', start)
    .lte('used_at', end)

  return cards.map((card: { id: number; user_name: string; profile_id: number | null; color: string }) => {
    const usedCount = history?.filter((h: { card_id: number }) => h.card_id === card.id).length || 0
    return {
      ...card,
      remaining_uses: Math.max(0, 3 - usedCount)
    }
  })
}

export default async function Home() {
  const cookieStore = await cookies()
  const profiles = await getProfiles()

  const profileCookie = cookieStore.get('selected_profile_id')?.value
  const profileId = profileCookie ? parseInt(profileCookie, 10) : undefined

  const now = toZonedTime(new Date(), 'Asia/Seoul')
  const cards = await getParkingCards(profileId)
  const history = await getUsageHistory(now.getFullYear(), now.getMonth() + 1, profileId)

  const cardIds = cards.map((c: { id: number }) => c.id)
  const thisMonth = format(now, 'yyyy-MM')
  const prevMonth = format(subMonths(now, 1), 'yyyy-MM')
  const [initialThisMonthPerfIds, initialPrevMonthPerfIds] = await Promise.all([
    getCardPerformance(cardIds, thisMonth),
    getCardPerformance(cardIds, prevMonth),
  ])

  // 프로필이 선택되지 않았을 때와 선택되었으나 카드가 없을 때를 명확히 구분
  const isProfileNotSelected = !profileId || isNaN(profileId)
  const isCardsEmpty = cards.length === 0

  return (
    <PullToRefresh>
    <main className="container">
      {isProfileNotSelected ? (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--card-bg)', borderRadius: '1.25rem', color: 'var(--text-muted)', border: '1.5px dashed var(--border)', marginTop: '1.5rem' }}>
          {profiles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="56" height="56" rx="16" fill="#f1f5f9"/>
                <circle cx="28" cy="22" r="9" stroke="#94a3b8" strokeWidth="2.5" fill="none"/>
                <path d="M19 40c0-5 4.03-9 9-9s9 4 9 9" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M33 18l5-5m0 0l-5-5m5 5h-7" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '1rem' }}>프로필이 없습니다</p>
              <p style={{ fontSize: '0.875rem' }}>상단 프로필 버튼을 눌러 프로필을 먼저 생성해 주세요.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="18" fill="#eff6ff"/>
                <rect x="12" y="12" width="40" height="40" rx="10" fill="#dbeafe"/>
                <text x="32" y="42" textAnchor="middle" fontSize="28" fontWeight="900" fill="#3b82f6" fontFamily="Arial, Helvetica, sans-serif">P</text>
                <rect x="14" y="49" width="36" height="3" rx="1.5" fill="#93c5fd"/>
              </svg>
              <p style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '1.1rem' }}>SC Parking에 오신 걸 환영합니다!</p>
              <p style={{ fontSize: '0.875rem' }}>서비스 이용을 위해 프로필을 선택해 주세요.</p>
            </div>
          )}
        </div>
      ) : isCardsEmpty ? (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--card-bg)', borderRadius: '1.25rem', color: 'var(--text-muted)', border: '1.5px dashed #fbbf24', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="60" height="60" rx="16" fill="#fef9c3"/>
              <rect x="10" y="19" width="40" height="27" rx="5" stroke="#f59e0b" strokeWidth="2.5" fill="none"/>
              <path d="M10 27h40" stroke="#f59e0b" strokeWidth="2.5"/>
              <circle cx="19" cy="35" r="3" fill="#f59e0b"/>
              <rect x="27" y="33" width="14" height="4" rx="2" fill="#fde68a"/>
              <path d="M30 12v7M27 15l3-3 3 3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '1rem' }}>등록된 카드가 없습니다</p>
            <p style={{ fontSize: '0.875rem' }}>[카드 관리] 메뉴에서 카드를 등록해 주세요.</p>
          </div>
        </div>
      ) : (
        <Calendar
          cards={cards}
          history={history}
          initialThisMonthPerfIds={initialThisMonthPerfIds}
          initialPrevMonthPerfIds={initialPrevMonthPerfIds}
          serverNowYearMonth={thisMonth}
        />
      )}
    </main>
    </PullToRefresh>
  )
}