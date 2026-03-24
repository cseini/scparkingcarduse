'use client'

import { useParkingCard } from './actions'
import { useState } from 'react'

interface ParkingCardProps {
  id: number
  userName: string
  remainingUses: number
  lastUsedAt: string | null
}

export default function ParkingCard({ id, userName, remainingUses, lastUsedAt }: ParkingCardProps) {
  const [loading, setLoading] = useState(false)

  const handleUse = async () => {
    if (loading || remainingUses <= 0) return
    
    setLoading(true)
    try {
      const result = await useParkingCard(id)
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

  const formatLastUsed = (dateStr: string | null) => {
    if (!dateStr) return '사용 이력 없음'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="parking-card">
      <h3 className="user-name">{userName}</h3>
      <div className="remaining">{remainingUses}</div>
      <div className="remaining-label">남은 횟수</div>
      <button 
        className="use-button" 
        onClick={handleUse}
        disabled={loading || remainingUses <= 0}
      >
        {loading ? '기록 중...' : '사용 기록'}
      </button>
      <div className="last-used">{formatLastUsed(lastUsedAt)}</div>
    </div>
  )
}
