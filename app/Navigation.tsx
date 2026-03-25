'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import ProfileManagerModal from './ProfileManagerModal'
import { checkProfilePin, setProfileCookieAction } from './actions'

interface Profile {
  id: number
  name: string
}

interface NavigationProps {
  profiles: Profile[]
  initialProfileId: string
}

export default function Navigation({ profiles, initialProfileId }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  
  // PIN Modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState('')

  const pathname = usePathname()
  const router = useRouter()
  
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialProfileId)

  // Sync state if prop changes (e.g. from server update)
  useEffect(() => {
    setSelectedProfileId(initialProfileId)
  }, [initialProfileId])

  // If no profile is selected and profiles exist, open selection modal
  useEffect(() => {
    if (profiles.length > 0 && !selectedProfileId) {
      setIsProfileModalOpen(true)
    }
  }, [profiles, selectedProfileId])

  const handleProfileClick = (profile: Profile) => {
    if (profile.id.toString() === selectedProfileId) {
      setIsProfileModalOpen(false)
      return
    }
    setTargetProfile(profile)
    setPinInput('')
    setPinError('')
    setIsPinModalOpen(true)
  }

  // Auto-submit when 4 digits are entered
  useEffect(() => {
    if (pinInput.length === 4 && !pinLoading) {
      // Small delay to let the UI update and show the 4th dot/digit
      const timer = setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        handlePinSubmit(fakeEvent);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pinInput, pinLoading]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetProfile || pinInput.length !== 4 || pinLoading) return

    setPinLoading(true)
    setPinError('')
    try {
      const result = await checkProfilePin(targetProfile.id, pinInput)
      if (result.success) {
        const idStr = targetProfile.id.toString()
        
        // 클라이언트 사이드 쿠키 즉시 설정
        Cookies.set('selected_profile_id', idStr, { expires: 365, path: '/' })
        
        // 서버 사이드 쿠키 설정 액션 호출
        await setProfileCookieAction(idStr)
        
        // 로컬 상태 업데이트
        setSelectedProfileId(idStr)
        
        setIsPinModalOpen(false)
        setIsProfileModalOpen(false)
        setPinInput('')

        // router.refresh() 대신 확실한 전체 새로고침 사용
        window.location.reload()
      } else {
        setPinError(result.error || '핀코드가 일치하지 않습니다.')
        setPinInput('')
      }
    } catch (err) {
      setPinError('오류가 발생했습니다.')
    } finally {
      setPinLoading(false)
    }
  }

  const toggleMenu = () => setIsOpen(!isOpen)

  const activeProfile = profiles.find(p => p.id.toString() === selectedProfileId)
  const activeName = activeProfile ? activeProfile.name : null

  return (
    <>
      <header className="header">
        <div className="header-content">
          <Link href="/" className="logo">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="#2563eb"/>
              <path d="M17 12H13.5V17H10.5V7H14.5C15.8807 7 17 8.11929 17 9.5V12ZM13.5 9.5V11.5H14.5C15.0523 11.5 15.5 11.0523 15.5 10.5C15.5 9.94772 15.0523 9.5 14.5 9.5H13.5Z" fill="white"/>
              <path opacity="0.3" d="M19 19L5 19" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.1rem', letterSpacing: '-0.02em' }}>SC PARKING</span>
          </Link>
          
          <div className="header-actions">
            <div 
              className={`active-profile-card ${!activeName ? 'unselected' : ''}`} 
              onClick={() => setIsProfileModalOpen(true)}
              style={!activeName ? { border: '1.5px dashed #cbd5e1', background: '#f1f5f9' } : {}}
            >
              {activeName ? (
                <>
                  <div className="profile-avatar">{activeName[0]}</div>
                  <span className="profile-name-text">{activeName}</span>
                </>
              ) : (
                <span className="profile-name-text" style={{ color: '#64748b' }}>프로필 선택</span>
              )}
            </div>

            <button className="hamburger" onClick={toggleMenu} aria-label="메뉴 열기">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {isOpen && (
        <>
          <div className="overlay" onClick={toggleMenu}></div>
          <nav className="side-menu">
            <button className="close-btn" onClick={toggleMenu} aria-label="메뉴 닫기">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <ul className="menu-list">
              <li>
                <Link href="/" className={`menu-item ${pathname === '/' ? 'active' : ''}`} onClick={toggleMenu}>홈 (캘린더)</Link>
              </li>
              <li>
                <Link href="/manage" className={`menu-item ${pathname === '/manage' ? 'active' : ''}`} onClick={toggleMenu}>카드 관리</Link>
              </li>
              <li>
                <Link href="/report" className={`menu-item ${pathname === '/report' ? 'active' : ''}`} onClick={toggleMenu}>버그 리포트</Link>
              </li>
              {activeName === '세인' && (
                <li>
                  <Link href="/admin/reports" className={`menu-item ${pathname === '/admin/reports' ? 'active' : ''}`} onClick={toggleMenu}>🐞 제보 목록 (Admin)</Link>
                </li>
              )}
            </ul>
          </nav>
        </>
      )}

      {/* Profile Selection Modal */}
      {isProfileModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>프로필 선택</h3>
              <button 
                onClick={() => { setIsProfileModalOpen(false); setIsManageModalOpen(true); }}
                style={{ fontSize: '0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                관리
              </button>
            </div>
            
            {profiles.length === 0 ? (
              <p style={{ color: '#64748b', padding: '1rem' }}>프로필이 없습니다. 관리에서 추가해 주세요.</p>
            ) : (
              <div className="profile-modal-grid">
                {profiles.map(p => (
                  <div 
                    key={p.id}
                    className={`profile-option-card ${selectedProfileId === p.id.toString() ? 'selected' : ''}`}
                    onClick={() => handleProfileClick(p)}
                  >
                    <div className="profile-avatar">{p.name[0]}</div>
                    <span className="profile-option-name">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="modal-close" onClick={() => setIsProfileModalOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* PIN Input Modal */}
      {isPinModalOpen && targetProfile && (
        <div className="modal-overlay" onClick={() => setIsPinModalOpen(false)} style={{ zIndex: 3000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '280px', padding: '1.5rem 1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>PIN 코드 입력</h3>
            <p className="modal-subtitle" style={{ fontSize: '0.75rem', marginBottom: '1.25rem' }}>[{targetProfile.name}] 프로필의 핀코드를 입력하세요.</p>
            <form onSubmit={handlePinSubmit}>
              <input 
                type="password" 
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/[^0-9]/g, ''));
                  setPinError('');
                }}
                className="input-field"
                style={{ 
                  fontSize: '1.5rem', 
                  textAlign: 'center', 
                  letterSpacing: '0.4rem', 
                  marginBottom: pinError ? '0.5rem' : '1.25rem',
                  borderColor: pinError ? '#ef4444' : '#cbd5e1',
                  width: '100%',
                  padding: '0.5rem'
                }}
                autoFocus
                disabled={pinLoading}
              />
              {pinError && <p style={{ color: '#ef4444', fontSize: '0.7rem', marginBottom: '1rem' }}>{pinError}</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="add-button" style={{ flex: 1, fontSize: '0.85rem' }} disabled={pinInput.length !== 4 || pinLoading}>
                  {pinLoading ? '확인 중...' : '확인'}
                </button>
                <button type="button" className="modal-close" style={{ flex: 1, marginTop: 0, fontSize: '0.85rem' }} onClick={() => setIsPinModalOpen(false)}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Management Modal */}
      {isManageModalOpen && (
        <ProfileManagerModal 
          profiles={profiles} 
          activeProfileId={selectedProfileId ? parseInt(selectedProfileId, 10) : undefined}
          onClose={() => setIsManageModalOpen(false)} 
        />
      )}
      </>
      )
      }