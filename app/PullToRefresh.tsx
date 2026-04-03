'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const THRESHOLD = 72

  useEffect(() => {
    const el = document.documentElement

    function onTouchStart(e: TouchEvent) {
      if (el.scrollTop > 0) return
      startY.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { startY.current = null; return }
      e.preventDefault()
      setPullY(Math.min(dy * 0.4, THRESHOLD + 20))
    }

    function onTouchEnd() {
      if (startY.current === null) return
      startY.current = null
      setPullY(prev => {
        if (prev >= THRESHOLD) {
          setRefreshing(true)
          router.refresh()
          setTimeout(() => setRefreshing(false), 1200)
        }
        return 0
      })
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [router])

  const progress = Math.min(pullY / THRESHOLD, 1)
  const ready = progress >= 1

  return (
    <>
      {/* 당기기 인디케이터 */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none overflow-hidden"
        style={{ height: `${pullY}px`, transition: pullY === 0 ? 'height 0.2s ease' : 'none' }}
      >
        <div
          className="flex items-end justify-center pb-2"
          style={{ opacity: progress }}
        >
          <div
            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${ready ? 'border-green-400 text-green-400' : 'border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600'}`}
          >
            {refreshing ? (
              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg
                className="w-3 h-3"
                style={{ transform: `rotate(${progress * 180}deg)`, transition: 'transform 0.1s' }}
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ transform: `translateY(${pullY}px)`, transition: pullY === 0 ? 'transform 0.2s ease' : 'none' }}>
        {children}
      </div>
    </>
  )
}
