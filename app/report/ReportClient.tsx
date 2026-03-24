'use client'

import { useState, useEffect } from 'react'
import { addReport, saveSubscription } from '../actions'
import { useRouter } from 'next/navigation'
import { useToast } from '../Toast'

// VAPID 키를 Uint8Array로 변환하는 유틸리티 함수
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

interface ReportClientProps {
  activeProfileId?: number
  activeProfileName?: string
}

export default function ReportClient({ activeProfileId, activeProfileName }: ReportClientProps) {
  const { showToast } = useToast()
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const router = useRouter()

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

      // 서비스 워커가 활성화될 때까지 대기 (아이폰 사파리 호환성)
      await navigator.serviceWorker.ready;
      
      // 혹시 모르니 활성 상태 확인 및 대기
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

      // [핵심] 기존 구독이 있다면 강제로 해제하여 새 키가 반영되도록 함
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      // 하드코딩된 새 VAPID 키 (환경변수 캐시 문제 해결용)
      const publicKey = "BNPVV7YciM1jX1zBRb20scPZX3OfrDOo-z92Yqoq67l5WDHEKhR8z1b-6J93_rLvs6YXabgB5CZAZ66auYMJpro";

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      const result = await saveSubscription(activeProfileId || null, sub)
      if (result.success) {
        setIsSubscribed(true)
        showToast('이제 리포트가 올라오면 알림을 보내드립니다! 🔔', 'success')
      } else {
        throw new Error(result.error || '구독 정보 저장 실패');
      }
    } catch (err: any) {
      console.error(err)
      alert(`알림 설정 오류: ${err.message}`); 
      showToast('알림 설정 중 오류가 발생했습니다.', 'error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || loading) return

    setLoading(true)
    try {
      const result = await addReport(activeProfileId || null, type, content.trim())
      if (result.success) {
        showToast('소중한 의견 감사합니다! 성공적으로 제출되었습니다. ✨', 'success')
        router.push('/')
      } else {
        showToast(result.error || '제출 실패', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('오류가 발생했습니다. 다시 시도해 주세요.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="manage-section">
      {/* 관리자('세인')에게만 알림 설정 UI 노출 */}
      {activeProfileName === '세인' && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', margin: 0, color: '#334155' }}>실시간 알림 설정 🔔</h4>
              <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                {isSubscribed ? '알림 수신 중입니다.' : '리포트 알림을 받으시겠습니까?'}
              </p>
            </div>
            {!isSubscribed && (
              <button 
                onClick={handleSubscribe}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.4rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                알림 켜기
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>작성자</label>
          <div style={{ 
            padding: '0.75rem', 
            background: '#f1f5f9', 
            borderRadius: '0.5rem', 
            fontSize: '0.9rem',
            color: '#475569'
          }}>
            {activeProfileName ? `${activeProfileName} (현재 프로필)` : '익명'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>유형 선택</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setType('bug')}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '2px solid',
                borderColor: type === 'bug' ? '#ef4444' : '#e2e8f0',
                background: type === 'bug' ? '#fef2f2' : 'white',
                color: type === 'bug' ? '#ef4444' : '#64748b',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🐞 버그 제보
            </button>
            <button
              type="button"
              onClick={() => setType('feature')}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '2px solid',
                borderColor: type === 'feature' ? '#3b82f6' : '#e2e8f0',
                background: type === 'feature' ? '#eff6ff' : 'white',
                color: type === 'feature' ? '#3b82f6' : '#64748b',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              💡 기능 제안
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>상세 내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력해 주세요..."
            required
            rows={6}
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none'
            }}
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !content.trim()}
          style={{
            padding: '1rem',
            background: loading ? '#94a3b8' : '#1e293b',
            color: 'white',
            border: 'none',
            borderRadius: '0.75rem',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            marginTop: '0.5rem'
          }}
        >
          {loading ? '제출 중...' : '소중한 의견 보내기'}
        </button>
      </form>
    </div>
  )
}
