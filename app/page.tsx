import { supabase } from '@/lib/supabaseClient'
import Calendar from './Calendar'
import { getUsageHistory, getProfiles, getCardPerformance } from './actions'
import { cookies } from 'next/headers'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

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
  const now = new Date()
  const start = startOfMonth(now).toISOString()
  const end = endOfMonth(now).toISOString()

  const { data: history } = await supabase
    .from('parking_usage_history')
    .select('card_id')
    .gte('used_at', start)
    .lte('used_at', end)

  return cards.map((card: any) => {
    const usedCount = history?.filter((h: any) => h.card_id === card.id).length || 0
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

  const now = new Date()
  const cards = await getParkingCards(profileId)
  const history = await getUsageHistory(now.getFullYear(), now.getMonth() + 1, profileId)

  const cardIds = cards.map((c: any) => c.id)
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
    <main className="container">
      {isProfileNotSelected ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '1rem', color: '#64748b', border: '1px dashed #cbd5e1' }}>
          {profiles.length === 0 ? (
            <p>프로필이 없습니다. 상단 프로필 버튼을 눌러 프로필을 먼저 생성해 주세요.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <p style={{ fontWeight: 600, color: '#1e293b' }}>환영합니다! 👋</p>
              <p>서비스 이용을 위해 프로필을 선택해 주세요.</p>
            </div>
          )}
        </div>
      ) : isCardsEmpty ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fef3c7', borderRadius: '1rem', color: '#92400e', border: '1px solid #fde68a' }}>
          <p>선택된 프로필에 카드가 존재하지 않습니다.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>[카드 관리] 메뉴에서 카드를 등록해 주세요.</p>
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
  )
}