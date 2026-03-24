'use client'

import { resetAllCards, initializeCards } from './actions'
import { useState } from 'react'

export default function ResetButton({ isEmpty }: { isEmpty: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (loading) return
    const confirmMessage = isEmpty 
      ? "데이터가 비어 있습니다. 초기화(나, 와이프, 형, 처남 각각 3회)를 진행하시겠습니까?" 
      : "모든 카드의 남은 횟수를 3회로 초기화하시겠습니까?"
    
    if (!confirm(confirmMessage)) return

    setLoading(true)
    try {
      const result = isEmpty ? await initializeCards() : await resetAllCards()
      if (!result.success) {
        alert(result.error)
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="reset-container">
      <button 
        className="reset-button" 
        onClick={handleReset}
        disabled={loading}
      >
        {loading ? '처리 중...' : (isEmpty ? '초기 데이터 생성' : '전체 초기화 (매월 1일)')}
      </button>
    </div>
  )
}
