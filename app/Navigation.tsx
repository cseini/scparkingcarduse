'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      <header className="header">
        <div className="header-content">
          <Link href="/" className="logo">
            🅿️ 주차 관리
          </Link>
          <button className="hamburger" onClick={toggleMenu} aria-label="메뉴 열기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
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
