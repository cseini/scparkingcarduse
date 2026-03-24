import { supabase } from '@/lib/supabaseClient'
import Calendar from './Calendar'
import { getUsageHistory } from './actions'
import { cookies } from 'next/headers'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function getParkingCards(profileId?: number) {
  let query = supabase
    .from('parking_cards')
    .select('*')
    .order('id', { ascending: true })

  if (profileId) {
    query = query.eq('profile_id', profileId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching parking cards:', error)
    return []
  }

  return data || []
}

export default async function Home() {
  const cookieStore = await cookies()
  const profileCookie = cookieStore.get('selected_profile_id')?.value
  const profileId = profileCookie && profileCookie !== 'all' ? Number(profileCookie) : undefined

  const now = new Date()
  const cards = await getParkingCards(profileId)
  const history = await getUsageHistory(now.getFullYear(), now.getMonth() + 1, profileId)
  const isEmpty = cards.length === 0

  return (
    <main className="container">
      <h1>SC제일본점 무료주차 🅿️</h1>
      
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fef3c7', borderRadius: '1rem', color: '#92400e' }}>
          <p>선택된 프로필에 카드가 존재하지 않습니다.</p>
          <p>오른쪽 상단 메뉴의 [카드 관리]에서 카드를 등록해 주세요.</p>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {cards.map((card) => {
              const color = card.color || '#cbd5e1'
              return (
                <div 
                  key={card.id} 
                  className="parking-card"
                  style={{ borderColor: color, backgroundColor: `${color}10` }}
                >
                  <h3 className="user-name" style={{ color }}>{card.user_name}</h3>
                  <div className="remaining" style={{ color }}>{card.remaining_uses}</div>
                  <div className="remaining-label">회 남음</div>
                </div>
              )
            })}
          </div>

          <Calendar cards={cards} history={history} />
        </>
      )}
    </main>
  )
}

