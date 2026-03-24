import { supabase } from '@/lib/supabaseClient'
import ParkingCard from './ParkingCard'
import ResetButton from './ResetButton'

export const dynamic = 'force-dynamic'

async function getParkingCards() {
  const { data, error } = await supabase
    .from('parking_cards')
    .select('*')
    .order('id', { ascending: true })

  if (error) {
    console.error('Error fetching parking cards:', error)
    return []
  }

  return data || []
}

export default async function Home() {
  const cards = await getParkingCards()
  const isEmpty = cards.length === 0

  return (
    <main className="container">
      <h1>SC제일본점 무료주차 🅿️</h1>
      
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fef3c7', borderRadius: '1rem', color: '#92400e' }}>
          <p>카드 데이터가 존재하지 않습니다.</p>
          <p>아래 버튼을 눌러 초기 데이터를 생성해 주세요.</p>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((card) => (
            <ParkingCard 
              key={card.id} 
              id={card.id}
              userName={card.user_name}
              remainingUses={card.remaining_uses}
              lastUsedAt={card.last_used_at}
            />
          ))}
        </div>
      )}

      <ResetButton isEmpty={isEmpty} />
    </main>
  )
}