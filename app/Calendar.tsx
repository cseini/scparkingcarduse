'use client'

import { useState } from 'react'
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
import { useParkingCard } from './actions'

interface UsageRecord {
  id: number
  card_id: number
  user_name: string
  used_at: string
}

interface ParkingCardData {
  id: number
  user_name: string
  remaining_uses: number
}

interface CalendarProps {
  cards: ParkingCardData[]
  history: UsageRecord[]
}

export default function Calendar({ cards, history }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

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

  const handleDateClick = (day: Date) => {
    setSelectedDate(day)
    setIsModalOpen(true)
  }

  const handleUseCard = async (cardId: number) => {
    if (!selectedDate || loading) return
    
    setLoading(true)
    try {
      const result = await useParkingCard(cardId, selectedDate.toISOString())
      if (!result.success) {
        alert(result.error)
      } else {
        setIsModalOpen(false)
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={prevMonth}>&lt;</button>
        <h2>{format(currentMonth, 'yyyy년 MM월', { locale: ko })}</h2>
        <button onClick={nextMonth}>&gt;</button>
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
              onClick={() => handleDateClick(day)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              <div className="usage-indicators">
                {dayHistory.map((h, i) => (
                  <div key={i} className={`usage-tag user-${h.user_name}`}>
                    {h.user_name}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {isModalOpen && selectedDate && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{format(selectedDate, 'M월 d일', { locale: ko })} 카드 사용 기록</h3>
            <p className="modal-subtitle">기록할 카드를 선택하세요</p>
            <div className="modal-buttons">
              {cards.map((card) => (
                <button 
                  key={card.id} 
                  className={`modal-use-button user-${card.user_name}`}
                  onClick={() => handleUseCard(card.id)}
                  disabled={loading || card.remaining_uses <= 0}
                >
                  <span className="button-user-name">{card.user_name}</span>
                  <span className="button-remaining">({card.remaining_uses}회 남음)</span>
                </button>
              ))}
            </div>
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}