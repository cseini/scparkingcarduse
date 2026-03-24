import { cookies } from 'next/headers'
import ReportClient from './ReportClient'
import { getProfiles } from '../actions'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function ReportPage() {
  const cookieStore = await cookies()
  const profiles = await getProfiles()
  
  let profileCookie = cookieStore.get('selected_profile_id')?.value
  
  if (!profileCookie && profiles.length > 0) {
    profileCookie = profiles[0].id.toString()
  }

  const profileId = profileCookie ? Number(profileCookie) : undefined
  const activeProfile = profiles.find(p => p.id === profileId)

  return (
    <main className="container">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>버그 리포트 & 제안 💌</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          앱 사용 중 불편한 점이나 추가되었으면 하는 기능이 있다면 알려주세요.
        </p>
      </div>
      
      <ReportClient activeProfileId={profileId} activeProfileName={activeProfile?.name} />
    </main>
  )
}
