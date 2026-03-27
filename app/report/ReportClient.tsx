'use client'

import { useState, useEffect } from 'react'
import { addReport, saveSubscription, addComment, deleteComment } from '../actions'
import { useRouter } from 'next/navigation'
import { useToast } from '../Toast'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
  type: string
  content: string
  created_at: string
  parking_report_comments?: Comment[]
}

interface ReportClientProps {
  activeProfileId?: number
  activeProfileName?: string
  myReports: Report[]
}

export default function ReportClient({ activeProfileId, activeProfileName, myReports: initialMyReports }: ReportClientProps) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<'submit' | 'myreports'>('submit')
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [myReports, setMyReports] = useState<Report[]>(initialMyReports)
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [commentLoading, setCommentLoading] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    setMyReports(initialMyReports)
  }, [initialMyReports])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(sub => {
          if (sub) setIsSubscribed(true)
        })
      })
    }
  }, [])

  const handleSubscribe = async () => {
    if (!('serviceWorker' in navigator)) return alert('이 브라우저는 알림을 지원하지 않습니다.')

    // @ts-ignore
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      return alert('아이폰은 "하단 공유 버튼 > 홈 화면에 추가"를 한 뒤 실행해야 알림을 받을 수 있습니다.')
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        showToast('알림 권한이 거부되었습니다.', 'error')
        return
      }

      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
      await navigator.serviceWorker.ready;

      if (!registration.active) {
        await new Promise<void>((resolve) => {
          const sw = registration!.installing || registration!.waiting;
          if (sw) {
            sw.addEventListener('statechange', (e: any) => {
              if (e.target.state === 'activated') resolve();
            });
          } else {
            resolve();
          }
        });
      }

      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) await existingSub.unsubscribe();

      const publicKey = "BNPVV7YciM1jX1zBRb20scPZX3OfrDOo-z92Yqoq67l5WDHEKhR8z1b-6J93_rLvs6YXabgB5CZAZ66auYMJpro";
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      const result = await saveSubscription(activeProfileId || null, sub)
      if (result.success) {
        setIsSubscribed(true)
        const msg = activeProfileName === '세인'
          ? '새 리포트가 올라오면 알림을 드립니다! 🔔'
          : '세인님이 답글을 달면 알림을 드립니다! 🔔'
        showToast(msg, 'success')
      } else {
        throw new Error(result.error || '구독 정보 저장 실패');
      }
    } catch (err: any) {
      console.error(err)
      alert(`알림 설정 오류: ${err.message}`);
      showToast('알림 설정 중 오류가 발생했습니다.', 'error')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!content.trim() || loading) return
    setLoading(true)
    try {
      const result = await addReport(activeProfileId || null, type, content.trim())
      if (result.success) {
        showToast('소중한 의견 감사합니다! 성공적으로 제출되었습니다. ✨', 'success')
        setContent('')
        router.refresh()
        setTab('myreports')
      } else {
        showToast(result.error || '제출 실패', 'error')
      }
    } catch {
      showToast('오류가 발생했습니다. 다시 시도해 주세요.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async (reportId: number) => {
    const text = commentInputs[reportId]?.trim()
    if (!text || !activeProfileId || !activeProfileName) return
    setCommentLoading(reportId)
    try {
      const result = await addComment(reportId, activeProfileId, activeProfileName, text, false)
      if (result.success) {
        setCommentInputs(prev => ({ ...prev, [reportId]: '' }))
        showToast('댓글을 남겼습니다.', 'success')
        router.refresh()
      } else {
        showToast(result.error || '댓글 저장 실패', 'error')
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setCommentLoading(null)
    }
  }

  const handleDeleteComment = async (commentId: number, commentProfileId: number | null) => {
    if (commentProfileId !== activeProfileId) return
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

  const isAdminSein = activeProfileName === '세인'

  return (
    <div className="manage-section">
      {/* 알림 설정 카드 — 모든 사용자에게 노출 */}
      {activeProfileId && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1.1rem 1.25rem',
          background: isSubscribed ? '#f0fdf4' : 'var(--item-bg)',
          borderRadius: '1rem',
          border: '1px solid',
          borderColor: isSubscribed ? '#bbf7d0' : 'var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{isSubscribed ? '🔔' : '🔕'}</span>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-strong)' }}>
                {isSubscribed ? '알림 수신 중' : isAdminSein ? '리포트 실시간 알림' : '답글 알림 받기'}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {isSubscribed
                ? (isAdminSein ? '새 제보가 올라오면 즉시 알림을 드립니다.' : '세인님 답글이 달리면 알림을 드립니다.')
                : (isAdminSein ? '새 버그 제보나 기능 제안이 올라오면 알려드립니다.' : '내 리포트에 답글이 달리면 알려드립니다.')}
            </p>
          </div>
          {isSubscribed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓ 활성</span>
              <button
                type="button"
                onClick={handleSubscribe}
                style={{ fontSize: '0.72rem', color: '#64748b', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                갱신
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              style={{
                padding: '0.5rem 1rem',
                background: '#1e293b',
                color: 'white',
                border: 'none',
                borderRadius: '0.6rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              알림 켜기
            </button>
          )}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {(['submit', 'myreports'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '0.6rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
              color: tab === t ? '#2563eb' : 'var(--text-muted)',
              fontWeight: tab === t ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'all 0.15s'
            }}
          >
            {t === 'submit' ? '✍️ 제출하기' : `📋 내 리포트${myReports.length > 0 ? ` (${myReports.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* 제출 폼 */}
      {tab === 'submit' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>작성자</label>
            <div style={{ padding: '0.75rem', background: 'var(--item-bg)', borderRadius: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {activeProfileName ? `${activeProfileName} (현재 프로필)` : '익명'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>유형 선택</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => setType('bug')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '2px solid', borderColor: type === 'bug' ? '#ef4444' : 'var(--border)', background: type === 'bug' ? '#fef2f2' : 'var(--card-bg)', color: type === 'bug' ? '#ef4444' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                🐞 버그 제보
              </button>
              <button type="button" onClick={() => setType('feature')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '2px solid', borderColor: type === 'feature' ? '#3b82f6' : 'var(--border)', background: type === 'feature' ? '#eff6ff' : 'var(--card-bg)', color: type === 'feature' ? '#3b82f6' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                💡 기능 제안
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>상세 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력해 주세요..."
              required
              rows={6}
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'none', outline: 'none', background: 'var(--input-bg)', color: 'var(--foreground)' }}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !content.trim()}
            style={{ padding: '1rem', background: loading ? '#94a3b8' : '#1e293b', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s', marginTop: '0.5rem' }}
          >
            {loading ? '제출 중...' : '소중한 의견 보내기'}
          </button>
        </form>
      )}

      {/* 내 리포트 탭 */}
      {tab === 'myreports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {myReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
              <p>아직 제출한 리포트가 없습니다.</p>
            </div>
          ) : (
            myReports.map((report) => {
              const comments = report.parking_report_comments || []
              const hasNewAdminReply = comments.some(c => c.is_admin)

              return (
                <div key={report.id} style={{
                  background: 'var(--card-bg)',
                  borderRadius: '1rem',
                  border: `1px solid ${hasNewAdminReply ? '#bfdbfe' : 'var(--border)'}`,
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow)'
                }}>
                  <div style={{ padding: '1.1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.7rem', fontWeight: 700, background: report.type === 'bug' ? '#fee2e2' : '#dcfce7', color: report.type === 'bug' ? '#ef4444' : '#10b981' }}>
                          {report.type === 'bug' ? '버그' : '제안'}
                        </span>
                        {comments.length > 0 && (
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '0.4rem', background: '#eff6ff', color: '#2563eb', fontWeight: 700 }}>
                            💬 {comments.length}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {format(new Date(report.created_at), 'MM/dd HH:mm', { locale: ko })}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: '0 0 0.75rem 0' }}>
                      {report.content}
                    </p>

                  </div>

                  {/* 댓글 스레드 */}
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--item-bg)', padding: '0.9rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {comments.length === 0 ? (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>아직 댓글이 없습니다.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {comments
                            .slice()
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            .map((comment) => (
                              <div key={comment.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexDirection: comment.is_admin ? 'row-reverse' : 'row' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: comment.is_admin ? '#2563eb' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: comment.is_admin ? 'white' : '#64748b', flexShrink: 0 }}>
                                  {comment.author_name[0]}
                                </div>
                                <div style={{ maxWidth: '80%', background: comment.is_admin ? '#2563eb' : 'var(--card-bg)', color: comment.is_admin ? 'white' : 'var(--foreground)', padding: '0.45rem 0.7rem', borderRadius: comment.is_admin ? '1rem 0.25rem 1rem 1rem' : '0.25rem 1rem 1rem 1rem', fontSize: '0.83rem', lineHeight: 1.5, border: comment.is_admin ? 'none' : '1px solid var(--border)' }}>
                                  <div style={{ fontSize: '0.62rem', fontWeight: 700, marginBottom: '0.15rem', opacity: 0.75 }}>
                                    {comment.author_name} · {format(new Date(comment.created_at), 'MM/dd HH:mm')}
                                  </div>
                                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                                </div>
                                {comment.profile_id === activeProfileId && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id, comment.profile_id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.65rem', padding: '0.2rem', alignSelf: 'center', flexShrink: 0 }}
                                    title="삭제"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      )}

                      {/* 댓글 입력 (로그인 상태에서만) */}
                      {activeProfileId && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <input
                            type="text"
                            placeholder="댓글을 입력하세요..."
                            value={commentInputs[report.id] || ''}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [report.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(report.id) } }}
                            disabled={commentLoading === report.id}
                            style={{ flex: 1, padding: '0.55rem 0.7rem', borderRadius: '0.6rem', border: '1px solid var(--border)', fontSize: '0.82rem', background: 'var(--input-bg)', color: 'var(--foreground)', outline: 'none' }}
                          />
                          <button
                            onClick={() => handleAddComment(report.id)}
                            disabled={commentLoading === report.id || !commentInputs[report.id]?.trim()}
                            style={{ padding: '0.55rem 0.9rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.6rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: (!commentInputs[report.id]?.trim() || commentLoading === report.id) ? 0.5 : 1 }}
                          >
                            {commentLoading === report.id ? '...' : '전송'}
                          </button>
                        </div>
                      )}
                    </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
