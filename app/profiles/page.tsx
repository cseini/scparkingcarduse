import { getProfiles } from '../actions'
import ProfileClient from './ProfileClient'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function ProfilesPage() {
  const profiles = await getProfiles()

  return (
    <main className="container">
      <h1>프로필 관리 👤</h1>
      <p className="page-desc">사용자 이름과 색상을 지정하여 달력에 표시될 라벨을 꾸며보세요.</p>
      
      <ProfileClient profiles={profiles} />
    </main>
  )
}
