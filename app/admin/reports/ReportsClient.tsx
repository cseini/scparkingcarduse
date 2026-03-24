'use client'

import { useState, useEffect } from 'react'
import { getReports, deleteReport } from '../../actions'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { useToast } from '../../Toast'
import Cookies from 'js-cookie'
import { useRouter } from 'next/navigation'

interface Report {
  id: number
  profile_id: number | null
  type: string
  content: string
  created_at: string
  profiles?: { name: string }
}

export default function ReportsClient({ initialReports }: { initialReports: any[] }) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()
  const router = useRouter()

  // 서버에서 props가 변경될 때마다(예: router.refresh() 호출 시) 로컬 상태 동기화
  useEffect(() => {
    setReports(initialReports)
  }, [initialReports])

  // 어드민 체크 (간이 보안: 쿠키에 저장된 프로필 ID의 이름을 Navigation에서 이미 검증하지만 여기서도 확인 가능하면 좋습니다.)
  // 하지만 여기서는 리스트 렌더링에 집중하겠습니다.

  const handleDelete = async (id: number) => {
    if (!confirm('이 리포트를 삭제하시겠습니까?')) return
    setLoading(true)
    try {
      // 1. 낙관적 업데이트: UI에서 먼저 제거
      setReports(reports.filter(r => r.id !== id))
      
      // 2. 서버에 삭제 요청
      const result = await deleteReport(id)
      if (result.success) {
        showToast('리포트가 삭제되었습니다.', 'success')
        // 3. Next.js 라우터 캐시 무효화 및 새로운 데이터 페칭 트리거
        router.refresh()
      } else {
        // 롤백: 삭제 실패 시 원래 상태로 복구
        setReports(initialReports)
        showToast(result.error || '삭제 실패', 'error')
      }
    } catch (err) {
      setReports(initialReports) // 에러 시 롤백
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', color: '#1e293b' }}>🐞 제보 목록 (Admin)</h1>
      
      {reports.length === 0 ? (
        <div className="empty-msg">제보된 내용이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reports.map((report) => (
            <div key={report.id} style={{ 
              background: 'white', 
              padding: '1.25rem', 
              borderRadius: '1rem', 
              boxShadow: 'var(--shadow)',
              border: '1px solid #e2e8f0',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '0.4rem', 
                    fontSize: '0.7rem', 
                    fontWeight: 700,
                    background: report.type === 'bug' ? '#fee2e2' : '#dcfce7',
                    color: report.type === 'bug' ? '#ef4444' : '#10b981'
                  }}>
                    {report.type === 'bug' ? '버그' : '제안'}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                    {report.profiles?.name || '익명'}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  {format(new Date(report.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                </span>
              </div>
              <p style={{ 
                fontSize: '0.95rem', 
                color: '#334155', 
                lineHeight: 1.5, 
                whiteSpace: 'pre-wrap',
                margin: '0 0 1rem 0'
              }}>
                {report.content}
              </p>
              <button 
                onClick={() => handleDelete(report.id)}
                disabled={loading}
                style={{ 
                  background: '#f1f5f9', 
                  border: 'none', 
                  color: '#ef4444', 
                  fontSize: '0.75rem', 
                  padding: '0.4rem 0.8rem', 
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
