'use client'

import { useState, useEffect } from 'react'
import { getReports, deleteReport, addComment, deleteComment } from '../../actions'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { useToast } from '../../Toast'
import { useRouter } from 'next/navigation'

interface Comment {
  id: number
  author_name: string
  content: string
  is_admin: boolean
  created_at: string
  profile_id: number | null
}

interface Report {
  id: number
  profile_id: number | null
  type: string
  content: string
  created_at: string
  profiles?: { name: string }
  parking_report_comments?: Comment[]
}

interface ReportsClientProps {
  initialReports: Report[]
  adminProfileId: number
  adminProfileName: string
  targetReportId?: number
}

export default function ReportsClient({ initialReports, adminProfileId, adminProfileName, targetReportId }: ReportsClientProps) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [loading, setLoading] = useState(false)
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [commentLoading, setCommentLoading] = useState<number | null>(null)
  const { showToast } = useToast()
  const router = useRouter()

  useEffect(() => { setReports(initialReports) }, [initialReports])

  useEffect(() => {
    if (!targetReportId) return
    const el = document.getElementById(`report-${targetReportId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [targetReportId])

  const handleDelete = async (id: number) => {
    if (!confirm('이 리포트를 삭제하시겠습니까?')) return
    setLoading(true)
    try {
      setReports(reports.filter(r => r.id !== id))
      const result = await deleteReport(id)
      if (result.success) {
        showToast('리포트가 삭제되었습니다.', 'success')
        router.refresh()
      } else {
        setReports(initialReports)
        showToast(result.error || '삭제 실패', 'error')
      }
    } catch {
      setReports(initialReports)
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async (reportId: number) => {
    const content = commentInputs[reportId]?.trim()
    if (!content) return
    setCommentLoading(reportId)
    try {
      const result = await addComment(reportId, adminProfileId, adminProfileName, content, true)
      if (result.success) {
        setCommentInputs(prev => ({ ...prev, [reportId]: '' }))
        showToast('답글을 전송했습니다.', 'success')
        router.refresh()
      } else {
        showToast(result.error || '답글 저장 실패', 'error')
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setCommentLoading(null)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return
    try {
      const result = await deleteComment(commentId)
      if (result.success) {
        showToast('댓글이 삭제되었습니다.', 'success')
        router.refresh()
      } else {
        showToast(result.error || '삭제 실패', 'error')
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error')
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-strong)' }}>
        🐞 제보 목록 (Admin)
      </h1>

      {reports.length === 0 ? (
        <div className="empty-msg">제보된 내용이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reports.map((report) => {
            const comments = report.parking_report_comments || []

            return (
              <div key={report.id} id={`report-${report.id}`} style={{
                background: 'var(--card-bg)',
                borderRadius: '1rem',
                boxShadow: targetReportId === report.id ? '0 0 0 2px #2563eb40' : 'var(--shadow)',
                border: `1px solid ${targetReportId === report.id ? '#2563eb' : 'var(--border)'}`,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '1.25rem' }}>
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
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {report.profiles?.name || '익명'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {format(new Date(report.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </span>
                  </div>

                  <p style={{
                    fontSize: '0.95rem',
                    color: 'var(--foreground)',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    margin: '0 0 1rem 0'
                  }}>
                    {report.content}
                  </p>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleDelete(report.id)}
                      disabled={loading}
                      style={{
                        background: 'var(--item-bg)',
                        border: '1px solid var(--border)',
                        color: '#ef4444',
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* 댓글 영역 */}
                <div style={{
                    borderTop: '1px solid var(--border)',
                    background: 'var(--item-bg)',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    {/* 기존 댓글 목록 */}
                    {comments.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
                        아직 댓글이 없습니다.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {comments
                          .slice()
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map((comment) => (
                            <div key={comment.id} style={{
                              display: 'flex',
                              gap: '0.5rem',
                              alignItems: 'flex-start',
                              flexDirection: comment.is_admin ? 'row-reverse' : 'row'
                            }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: comment.is_admin ? '#2563eb' : '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: comment.is_admin ? 'white' : '#64748b',
                                flexShrink: 0
                              }}>
                                {comment.author_name[0]}
                              </div>
                              <div style={{
                                maxWidth: '80%',
                                background: comment.is_admin ? '#2563eb' : 'var(--card-bg)',
                                color: comment.is_admin ? 'white' : 'var(--foreground)',
                                padding: '0.5rem 0.75rem',
                                borderRadius: comment.is_admin ? '1rem 0.25rem 1rem 1rem' : '0.25rem 1rem 1rem 1rem',
                                fontSize: '0.85rem',
                                lineHeight: 1.5,
                                border: comment.is_admin ? 'none' : '1px solid var(--border)',
                                position: 'relative'
                              }}>
                                <div style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  marginBottom: '0.2rem',
                                  opacity: 0.75
                                }}>
                                  {comment.author_name} · {format(new Date(comment.created_at), 'MM/dd HH:mm')}
                                </div>
                                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                              </div>
                              {/* 어드민은 모든 댓글 삭제 가능 */}
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  padding: '0.2rem',
                                  alignSelf: 'center',
                                  flexShrink: 0
                                }}
                                title="댓글 삭제"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* 댓글 입력 */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <input
                        type="text"
                        placeholder="답글을 입력하세요..."
                        value={commentInputs[report.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [report.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(report.id) } }}
                        disabled={commentLoading === report.id}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.75rem',
                          borderRadius: '0.6rem',
                          border: '1px solid var(--border)',
                          fontSize: '0.85rem',
                          background: 'var(--input-bg)',
                          color: 'var(--foreground)',
                          outline: 'none'
                        }}
                      />
                      <button
                        onClick={() => handleAddComment(report.id)}
                        disabled={commentLoading === report.id || !commentInputs[report.id]?.trim()}
                        style={{
                          padding: '0.6rem 1rem',
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.6rem',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                          opacity: (!commentInputs[report.id]?.trim() || commentLoading === report.id) ? 0.5 : 1
                        }}
                      >
                        {commentLoading === report.id ? '...' : '전송'}
                      </button>
                    </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
