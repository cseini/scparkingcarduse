'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

interface Profile {
  id: number
  name: string
}

interface NavigationProps {
  profiles: Profile[]
}

export default function Navigation({ profiles }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Try to load initial profile from cookies
  const initialProfileId = Cookies.get('selected_profile_id')
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialProfileId || 'all')

  // Listen to profile changes and set cookie
  useEffect(() => {
    if (selectedProfileId === 'all') {
      Cookies.remove('selected_profile_id')
    } else {
      Cookies.set('selected_profile_id', selectedProfileId, { expires: 365 })
    }
    // Simple way to refresh the current route to refetch data with new cookie
    router.refresh()
  }, [selectedProfileId, router])

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      <header className="header">
        <div className="header-content">
          <Link href="/" className="logo">
            🅿️ 주차 관리
          </Link>
          
          <div className="header-actions">
            <select 
              className="profile-select"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              aria-label="프로필 선택"
            >
              <option value="all">모든 프로필</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

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
                <Link 
                  href="/" 
                  className={`menu-item ${pathname === '/' ? 'active' : ''}`}
                  onClick={toggleMenu}
                >
                  홈 (캘린더)
                </Link>
              </li>
              <li>
                <Link 
                  href="/manage" 
                  className={`menu-item ${pathname === '/manage' ? 'active' : ''}`}
                  onClick={toggleMenu}
                >
                  카드 관리
                </Link>
              </li>
              <li>
                <Link 
                  href="/profiles" 
                  className={`menu-item ${pathname === '/profiles' ? 'active' : ''}`}
                  onClick={toggleMenu}
                >
                  프로필 관리
                </Link>
              </li>
            </ul>
          </nav>
        </>
      )}
    </>
  )
}