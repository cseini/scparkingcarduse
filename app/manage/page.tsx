import { supabase } from '@/lib/supabaseClient'
import ManageClient from './ManageClient'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function getParkingCards() {
  const { data, error } = await supabase
    .from('parking_cards')
    .select('id, user_name, remaining_uses')
    .order('id', { ascending: true })

  if (error) {
    console.error('Error fetching parking cards:', error)
    return []
  }

  return data || []
}

export default async function ManagePage() {
  const cards = await getParkingCards()

  return (
    <main className="container">
      <h1>카드 관리 💳</h1>
      <p className="page-desc">새로운 카드를 추가하거나 기존 카드를 삭제할 수 있습니다.</p>
      
      <ManageClient cards={cards} />
    </main>
  )
}
