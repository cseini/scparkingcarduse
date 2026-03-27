'use client'

import { useState, useEffect } from 'react'
import { addProfile, updateProfile, deleteProfile, saveSubscription } from './actions'
import { useToast } from './Toast'

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

const VAPID_PUBLIC_KEY = "BNPVV7YciM1jX1zBRb20scPZX3OfrDOo-z92Yqoq67l5WDHEKhR8z1b-6J93_rLvs6YXabgB5CZAZ66auYMJpro";

interface Profile {
  id: number
  name: string
}

interface ProfileManagerModalProps {
  profiles: Profile[]
  activeProfileId?: number
  onClose: () => void
}

export default function ProfileManagerModal({ profiles, activeProfileId, onClose }: ProfileManagerModalProps) {
  const activeProfile = profiles.find(p => p.id === activeProfileId)
  const isAdmin = activeProfile?.name === '세인'
  const { showToast } = useToast()
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPin, setEditPin] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

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

    setPushLoading(true)
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

      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })

      // [핵심] 현재 선택된 프로필 ID(activeProfileId)를 함께 저장
      const result = await saveSubscription(activeProfileId || null, sub)
      if (result.success) {
        setIsSubscribed(true)
        showToast('실시간 알림이 활성화되었습니다! 🔔', 'success')
      } else {
        throw new Error(result.error || '구독 정보 저장 실패');
      }
    } catch (err: any) {
      console.error(err)
      showToast(`알림 설정 오류: ${err.message}`, 'error')
    } finally {
      setPushLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || newPin.length !== 4 || loading) return
    setLoading(true)
    try {
      const result = await addProfile(newName.trim(), newPin)
      if (result.success) {
        showToast('새 프로필이 생성되었습니다.', 'success')
        setNewName('')
        setNewPin('')
      } else {
        showToast(result.error || '추가 실패', 'error')
      }
    } catch (err) {
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`'${name}' 프로필을 삭제하시겠습니까?`)) return
    setLoading(true)
    try {
      const result = await deleteProfile(id)
      if (!result.success) {
        showToast(result.error || '삭제 실패', 'error')
      } else {
        showToast('프로필이 삭제되었습니다.', 'success')
      }
    } catch (err) {
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEditSave = async (id: number) => {
    if (!editName.trim() || loading) return
    if (editPin && editPin.length !== 4) {
      showToast('핀코드는 4자리여야 합니다.', 'error')
      return
    }
    setLoading(true)
    try {
      const result = await updateProfile(id, editName.trim(), editPin || undefined)
      if (result.success) {
        showToast('프로필 정보가 수정되었습니다.', 'success')
        setEditingId(null)
        setEditPin('')
      } else {
        showToast(result.error || '수정 실패', 'error')
      }
    } catch (err) {
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>프로필 관리</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        {/* 알림 설정 영역 추가 */}
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          background: isSubscribed ? '#f0fdf4' : '#f8fafc', 
          borderRadius: '0.75rem', 
          border: '1px dashed',
          borderColor: isSubscribed ? '#bcf0da' : '#cbd5e1'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', margin: 0, color: '#334155' }}>
                실시간 알림 {isSubscribed ? '수신 중 🔔' : '🔔'}
              </h4>
              <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                {isSubscribed ? '리포트 알림을 받고 있습니다.' : '리포트 알림을 받으시겠습니까?'}
              </p>
            </div>
            {!isSubscribed && (
              <button 
                onClick={handleSubscribe}
                disabled={pushLoading}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.75rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: pushLoading ? 0.7 : 1
                }}
              >
                {pushLoading ? '설정 중...' : '알림 켜기'}
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder="프로필 이름" 
              className="input-field"
              disabled={loading}
            />
            <input 
              type="password" 
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={newPin} 
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))} 
              placeholder="PIN (4자리)" 
              className="input-field"
              style={{ width: '100px' }}
              disabled={loading}
            />
          </div>
          <button type="submit" className="add-button" disabled={loading || !newName.trim() || newPin.length !== 4}>
            프로필 추가
          </button>
        </form>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {profiles.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center' }}>등록된 프로필이 없습니다.</p>
          ) : (
            <ul className="card-list" style={{ padding: 0, listStyle: 'none' }}>
              {profiles.map(p => (
                <li key={p.id} className="card-list-item" style={{ padding: '0.75rem', flexDirection: 'column', alignItems: 'stretch' }}>
                  {editingId === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)}
                          className="input-field"
                          placeholder="이름"
                        />
                        <input 
                          type="password" 
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={editPin} 
                          onChange={(e) => setEditPin(e.target.value.replace(/[^0-9]/g, ''))}
                          className="input-field"
                          placeholder="새 PIN"
                          style={{ width: '100px' }}
                        />
                      </div>
                      <div className="edit-actions">
                        <button onClick={() => handleEditSave(p.id)} className="save-button">저장</button>
                        <button onClick={() => { setEditingId(null); setEditPin(''); }} className="cancel-button">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <div className="card-actions">
                        {(isAdmin || p.id === activeProfileId) && (
                          <button onClick={() => { setEditingId(p.id); setEditName(p.name); }} className="edit-button">수정</button>
                        )}
                        {(isAdmin || p.id === activeProfileId) && (
                          <button onClick={() => handleDelete(p.id, p.name)} className="delete-button">삭제</button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="modal-close" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}