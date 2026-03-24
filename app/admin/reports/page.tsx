import { getReports, getProfiles } from '../../actions'
import { cookies } from 'next/headers'
import ReportsClient from './ReportsClient'
import { redirect } from 'next/navigation'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function AdminReportsPage() {
  const cookieStore = await cookies()
  const profiles = await getProfiles()
  const selectedProfileId = cookieStore.get('selected_profile_id')?.value

  // 관리자 권한 체크: 프로필 이름이 '세인'인 경우만 허용
  const currentProfile = profiles.find((p: any) => p.id.toString() === selectedProfileId)
  
  if (!currentProfile || currentProfile.name !== '세인') {
    // 권한이 없으면 홈으로 리다이렉트 (실제 운영 환경에서는 403 에러 페이지가 더 적절할 수 있습니다.)
    redirect('/')
  }

  const reports = await getReports()

  return (
    <main className="container">
      <ReportsClient initialReports={reports} />
    </main>
  )
}
