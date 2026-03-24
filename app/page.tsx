import { supabase } from '@/lib/supabaseClient'
import Calendar from './Calendar'
import { getUsageHistory, getProfiles } from './actions'
import { cookies } from 'next/headers'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function getParkingCards(profileId?: number) {
  if (!profileId) return []

  const { data, error } = await supabase
    .from('parking_cards')
    .select('*')
    .eq('profile_id', profileId)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error fetching parking cards:', error)
    return []
  }

  return data || []
}

export default async function Home() {
  const cookieStore = await cookies()
  const profiles = await getProfiles()
  
  let profileCookie = cookieStore.get('selected_profile_id')?.value
  
  if (!profileCookie && profiles.length > 0) {
    profileCookie = profiles[0].id.toString()
  }

  const profileId = profileCookie ? Number(profileCookie) : undefined
  
  const now = new Date()
  const cards = await getParkingCards(profileId)
  const history = await getUsageHistory(now.getFullYear(), now.getMonth() + 1, profileId)
  const isEmpty = cards.length === 0

  return (
    <main className="container">
      <h1>SC제일본점 무료주차 🅿️</h1>
      
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fef3c7', borderRadius: '1rem', color: '#92400e' }}>
          {profiles.length === 0 ? (
            <p>프로필이 없습니다. 상단 프로필 버튼을 눌러 프로필을 먼저 생성해 주세요.</p>
          ) : (
            <p>선택된 프로필에 카드가 존재하지 않습니다. [카드 관리]에서 카드를 등록해 주세요.</p>
          )}
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