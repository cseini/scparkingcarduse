import { getReports, getProfiles } from '../../actions'
import { cookies } from 'next/headers'
import ReportsClient from './ReportsClient'
import { redirect } from 'next/navigation'
import { ADMIN_NAME } from '../../constants'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const cookieStore = await cookies()
  const { id: targetId } = await searchParams
  const profiles = await getProfiles()
  const selectedProfileId = cookieStore.get('selected_profile_id')?.value

  const currentProfile = profiles.find((p: { id: number; name: string }) => p.id.toString() === selectedProfileId)

  if (!currentProfile || currentProfile.name !== ADMIN_NAME) {
    redirect('/')
  }

  const reports = await getReports()

  return (
    <main className="container">
      <ReportsClient
        initialReports={reports}
        adminProfileId={currentProfile.id}
        adminProfileName={currentProfile.name}
        targetReportId={targetId ? Number(targetId) : undefined}
      />
    </main>
  )
}
