import { supabase } from '@/lib/supabaseClient'
import ManageClient from './ManageClient'
import { getProfiles } from '../actions'
import { cookies } from 'next/headers'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function getParkingCards(profileId?: number) {
  if (!profileId) return []

  const { data, error } = await supabase
    .from('parking_cards')
    .select('id, user_name, remaining_uses, profile_id, color')
    .eq('profile_id', profileId)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error fetching parking cards:', error)
    return []
  }

  return data || []
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
  const activeProfile = profiles.find(p => p.id === profileId)

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
