'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Phase = 'idle' | 'refreshing' | 'done'

const THRESHOLD = 72
const INDICATOR_HEIGHT = 52

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pullY, setPullY] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const startY = useRef<number | null>(null)

  useEffect(() => {
    const el = document.getElementById('scroll-root') as HTMLElement | null
    if (!el) return
    const scrollEl: HTMLElement = el

    function onTouchStart(e: TouchEvent) {
      if (scrollEl.scrollTop > 0) return
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
          setPhase('refreshing')
          router.refresh()
          setTimeout(() => {
            setPhase('done')
            setTimeout(() => setPhase('idle'), 700)
          }, 1000)
        }
        return 0
      })
    }

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true })
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false })
    scrollEl.addEventListener('touchend', onTouchEnd)
    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart)
      scrollEl.removeEventListener('touchmove', onTouchMove)
      scrollEl.removeEventListener('touchend', onTouchEnd)
    }
  }, [router])

  const progress = Math.min(pullY / THRESHOLD, 1)
  const ready = progress >= 1

  // 인디케이터 영역 높이: pulling 중엔 pullY, 그 외엔 고정값 or 0
  const gapHeight = phase !== 'idle' ? INDICATOR_HEIGHT : pullY
  // pullY가 0으로 돌아갈 때, 그리고 phase 전환 시에만 transition 적용
  const useTransition = phase !== 'idle' || pullY === 0

  return (
    <div>
      {/* 인디케이터 영역 — 이 높이만큼 콘텐츠가 밀려남 */}
      <div
        style={{
          height: `${gapHeight}px`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: useTransition ? 'height 0.3s cubic-bezier(0.4,0,0.2,1)' : 'none',
          pointerEvents: 'none',
        }}
      >
        {phase === 'idle' && (
          // 당기는 중: 작은 원 + 화살표
          <div
            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
              ready
                ? 'border-green-400 text-green-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600'
            }`}
            style={{ opacity: progress }}
          >
            <svg
              width="12" height="12"
              style={{ transform: `rotate(${progress * 180}deg)`, transition: 'transform 0.1s' }}
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        {phase === 'refreshing' && (
          // 새로고침 중: 스피너 pill
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm text-xs font-medium text-gray-500 dark:text-gray-400">
            <svg width="12" height="12" className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>새로고침 중</span>
          </div>
        )}

        {phase === 'done' && (
          // 완료: 초록 체크 pill
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500 text-white shadow-sm text-xs font-semibold">
            <svg width="12" height="12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>완료</span>
          </div>
        )}
      </div>

      {children}
    </div>
  )
}
