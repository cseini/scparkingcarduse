'use client'

import { useState, useEffect } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  startOfWeek, 
  endOfWeek,
  isToday,
  addMonths,
  subMonths,
  isSaturday,
  isSunday
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { useParkingCard, deleteUsageHistory, checkAutoReset, getUsageHistory } from './actions'
import { useToast } from './Toast'

const TIMEZONE = 'Asia/Seoul'

interface UsageRecord {
  id: number
  card_id: number
  user_name: string
  used_at: string
  parking_cards?: { profile_id: number | null }
}

interface ParkingCardData {
  id: number
  user_name: string
  remaining_uses: number
  profile_id: number | null
  color: string
}

interface CalendarProps {
  cards: ParkingCardData[]
  history: UsageRecord[]
}

export default function Calendar({ cards, history: initialHistory }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(toZonedTime(new Date(), TIMEZONE))
  const [history, setHistory] = useState<UsageRecord[]>(initialHistory)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHistory, setSelectedHistory] = useState<UsageRecord | null>(null)
  const [loading, setLoading] = useState(false)

  const { showToast } = useToast()

  // Sync history if initialHistory changes (e.g. on profile switch)
  useEffect(() => {
    setHistory(initialHistory)
  }, [initialHistory])

  // Fetch history when currentMonth changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (cards.length > 0 && cards[0].profile_id) {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth() + 1
        const data = await getUsageHistory(year, month, cards[0].profile_id)
        setHistory(data)
      }
    }
    fetchHistory()
  }, [currentMonth, cards])

  // Auto-reset check when viewing calendar
  useEffect(() => {
    if (cards.length > 0 && cards[0].profile_id) {
      checkAutoReset(cards[0].profile_id)
    }
  }, [cards])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const getCardColor = (cardId: number) => {
    const card = cards.find(c => c.id === cardId)
    return card?.color || '#cbd5e1'
  }

  const handleDateClick = (day: Date) => {
    // 현재 월이 아닌 경우 클릭 무시
    if (!isSameDay(startOfMonth(day), monthStart)) return;
    
    setSelectedDate(day)
    setIsModalOpen(true)
  }

  const handleHistoryClick = (e: React.MouseEvent, record: UsageRecord) => {
    e.stopPropagation() 
    setSelectedHistory(record)
    setIsEditModalOpen(true)
  }

  const handleUseCard = async (cardId: number) => {
    if (!selectedDate || loading) return
    
    setLoading(true)
    try {
      const result = await useParkingCard(cardId, selectedDate.toISOString())
      if (!result.success) {
        showToast(result.error || '오류가 발생했습니다.', 'error')
      } else {
        showToast('사용 기록이 저장되었습니다. ✨', 'success')
        setIsModalOpen(false)
      }
    } catch (err) {
      console.error(err)
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteHistory = async () => {
    if (!selectedHistory || loading) return
    
    setLoading(true)
    try {
      const result = await deleteUsageHistory(selectedHistory.id, selectedHistory.card_id)
      if (!result.success) {
        showToast(result.error || '삭제 실패', 'error')
      } else {
        showToast('기록이 삭제되었습니다.', 'success')
        setIsEditModalOpen(false)
        setSelectedHistory(null)
      }
    } catch (err) {
      console.error('[Client] 삭제 중 에러 발생:', err)
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="card-grid">
        {cards.map((card) => {
          const color = card.color || '#cbd5e1'
          // 현재 history(선택된 월의 이력)에서 해당 카드의 사용 횟수 계산
          const usedCount = history.filter(h => h.card_id === card.id).length
          const remaining = Math.max(0, 3 - usedCount)
          
          return (
            <div 
              key={card.id} 
              className="parking-card"
              style={{ borderColor: color, backgroundColor: `${color}10` }}
            >
              <h3 className="user-name" style={{ color }}>{card.user_name}</h3>
              <div className="remaining" style={{ color }}>{remaining}</div>
              <div className="remaining-label">회 남음</div>
            </div>
          )
        })}
      </div>

      <div className="calendar-container">
        <div className="calendar-header">
          <button onClick={prevMonth} className="nav-btn">&lt;</button>
          <h2>{format(currentMonth, 'yyyy년 MM월', { locale: ko })}</h2>
          <button onClick={nextMonth} className="nav-btn">&gt;</button>
        </div>

      <div className="calendar-grid">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <div key={day} className={`calendar-day-label ${index === 0 ? 'sunday-label' : ''} ${index === 6 ? 'saturday-label' : ''}`}>
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dayHistory = history.filter((h) => isSameDay(new Date(h.used_at), day))
          const isCurrentMonth = isSameDay(startOfMonth(day), monthStart)
          
          let dayClass = 'calendar-day'
          if (!isCurrentMonth) dayClass += ' other-month'
          if (isToday(day)) dayClass += ' today'
          if (isSaturday(day)) dayClass += ' saturday'
          if (isSunday(day)) dayClass += ' sunday'
          
          return (
            <div 
              key={day.toISOString()} 
              className={dayClass}
              onClick={() => isCurrentMonth && handleDateClick(day)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              <div className="usage-center-container">
                {dayHistory.length > 0 && (
                  <div 
                    className="usage-tag-prominent"
                    style={{ 
                      backgroundColor: getCardColor(dayHistory[0].card_id),
                      color: '#fff'
                    }}
                    onClick={(e) => isCurrentMonth && handleHistoryClick(e, dayHistory[0])}
                    title="클릭하여 수정/삭제"
                  >
                    {dayHistory[0].user_name}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Usage Modal */}
      {isModalOpen && selectedDate && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{format(selectedDate, 'M월 d일', { locale: ko })} 카드 사용 기록</h3>
            <p className="modal-subtitle">기록할 카드를 선택하세요</p>
            <div className="modal-buttons">
              {cards.map((card) => {
                const color = card.color || '#cbd5e1'
                return (
                  <button 
                    key={card.id} 
                    className="modal-use-button"
                    style={{ borderColor: color }}
                    onClick={() => handleUseCard(card.id)}
                    disabled={loading || card.remaining_uses <= 0}
                  >
                    <span className="button-user-name" style={{ color }}>{card.user_name}</span>
                    <span className="button-remaining">({card.remaining_uses}회 남음)</span>
                  </button>
                )
              })}
            </div>
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* Edit/Delete History Modal */}
      {isEditModalOpen && selectedHistory && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>사용 기록 관리</h3>
            <p className="modal-subtitle">
              {format(new Date(selectedHistory.used_at), 'M월 d일', { locale: ko })} - {selectedHistory.user_name}
            </p>
            <div className="modal-actions-vertical">
              <button 
                className="delete-history-btn" 
                onClick={handleDeleteHistory}
                disabled={loading}
              >
                {loading ? '처리 중...' : '이 기록 삭제 및 횟수 복구'}
              </button>
            </div>
            <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}
