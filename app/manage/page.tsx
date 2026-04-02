import { supabase } from '@/lib/supabaseClient'
import ManageClient from './ManageClient'
import { getProfiles } from '../actions'
import { cookies } from 'next/headers'
import { startOfMonth, endOfMonth } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

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

export default async function ManagePage() {
  const cookieStore = await cookies()
  const profiles = await getProfiles()
  
  let profileCookie = cookieStore.get('selected_profile_id')?.value
  
  // If no cookie but profiles exist, default to first profile
  if (!profileCookie && profiles.length > 0) {
    profileCookie = profiles[0].id.toString()
  }

  const profileId = profileCookie ? Number(profileCookie) : undefined
  const cards = await getParkingCards(profileId)
  const activeProfile = profiles.find((p: { id: number; name: string }) => p.id === profileId)

  return (
    <main className="container">
      <h1>카드 관리 💳</h1>
      <p className="page-desc">
        {activeProfile 
          ? `[${activeProfile.name}] 프로필의 카드를 관리합니다.` 
          : '프로필을 먼저 선택하거나 생성해 주세요.'}
      </p>
      
      <ManageClient 
        cards={cards} 
        profiles={profiles} 
        activeProfileId={profileId} 
      />
    </main>
  )
}
