'use client'

import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'auto'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('auto')

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme') as Theme | null
      const initialTheme = savedTheme || 'auto'
      setTheme(initialTheme)
      applyTheme(initialTheme)
    } catch {
      applyTheme('auto')
    }
  }, [])

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t)
  }

  const toggleTheme = () => {
    let nextTheme: Theme = 'light'
    if (theme === 'light') nextTheme = 'dark'
    else if (theme === 'dark') nextTheme = 'auto'
    else nextTheme = 'light'

    setTheme(nextTheme)
    applyTheme(nextTheme)
    try {
      localStorage.setItem('theme', nextTheme)
    } catch {
      // 프라이빗 브라우징 등 localStorage 사용 불가 환경 무시
    }
  }

  return (
    <button 
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label="테마 변경"
      style={{
        background: 'var(--item-bg)',
        border: '1.5px solid var(--border)',
        borderRadius: '2rem',
        padding: '0.3rem 0.6rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        cursor: 'pointer',
        color: 'var(--foreground)',
        transition: 'all 0.3s ease',
        minWidth: '60px',
        justifyContent: 'center'
      }}
    >
      {theme === 'light' && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Light</span>
        </>
      )}
      {theme === 'dark' && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Dark</span>
        </>
      )}
      {theme === 'auto' && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Auto</span>
        </>
      )}
    </button>
  )
}
