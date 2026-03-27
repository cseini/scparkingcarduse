'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { ko } from 'date-fns/locale/ko'
import { toZonedTime } from 'date-fns-tz'
import { useParkingCard, deleteUsageHistory, checkAutoReset, getUsageHistory } from './actions'
import { useToast } from './Toast'

const TIMEZONE = 'Asia/Seoul'

// 🇰🇷 대한민국 공휴일 데이터 (2024-2026) — 날짜: 공휴일명
const HOLIDAY_NAMES: Record<string, Record<string, string>> = {
  '2024': {
    '01-01': '신정',
    '02-09': '설날 전날',
    '02-10': '설날',
    '02-11': '설날 다음날',
    '02-12': '대체공휴일',
    '03-01': '삼일절',
    '04-10': '선거일',
    '05-05': '어린이날',
    '05-06': '대체공휴일',
    '05-15': '부처님오신날',
    '06-06': '현충일',
    '08-15': '광복절',
    '09-16': '추석 전날',
    '09-17': '추석',
    '09-18': '추석 다음날',
    '10-03': '개천절',
    '10-09': '한글날',
    '12-25': '크리스마스',
  },
  '2025': {
    '01-01': '신정',
    '01-28': '설날 전날',
    '01-29': '설날',
    '01-30': '설날 다음날',
    '03-01': '삼일절',
    '03-03': '대체공휴일',
    '05-05': '어린이날',
    '05-06': '대체공휴일',
    '06-06': '현충일',
    '08-15': '광복절',
    '10-03': '개천절',
    '10-05': '추석 전날',
    '10-06': '추석',
    '10-07': '추석 다음날',
    '10-08': '대체공휴일',
    '10-09': '한글날',
    '12-25': '크리스마스',
  },
  '2026': {
    '01-01': '신정',
    '02-16': '설날 전날',
    '02-17': '설날',
    '02-18': '설날 다음날',
    '03-01': '삼일절',
    '03-02': '대체공휴일',
    '05-05': '어린이날',
    '05-24': '부처님오신날',
    '05-25': '대체공휴일',
    '06-06': '현충일',
    '08-15': '광복절',
    '09-24': '추석 전날',
    '09-25': '추석',
    '09-26': '추석 다음날',
    '10-03': '개천절',
    '10-05': '대체공휴일',
    '10-09': '한글날',
    '12-25': '크리스마스',
  },
}

function getHolidayName(date: Date): string | null {
  const year = date.getFullYear().toString()
  const monthDay = format(date, 'MM-dd')
  return HOLIDAY_NAMES[year]?.[monthDay] || null
}

function isHoliday(date: Date): boolean {
  return getHolidayName(date) !== null
}

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

  const refreshHistory = useCallback(async () => {
    if (cards.length > 0 && cards[0].profile_id) {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      const data = await getUsageHistory(year, month, cards[0].profile_id)
      setHistory(data)
    }
  }, [currentMonth, cards])

  useEffect(() => {
    const now = new Date()
    const isViewingCurrentMonth = currentMonth.getFullYear() === now.getFullYear() && currentMonth.getMonth() === now.getMonth()
    if (isViewingCurrentMonth) {
      setHistory(initialHistory)
    }
  }, [initialHistory, currentMonth])

  useEffect(() => {
    const now = new Date()
    const isCurrentRealMonth = currentMonth.getFullYear() === now.getFullYear() && currentMonth.getMonth() === now.getMonth()
    if (!isCurrentRealMonth) {
      refreshHistory()
    }
  }, [currentMonth, refreshHistory])

  useEffect(() => {
    if (cards.length > 0 && cards[0].profile_id) {
      checkAutoReset(cards[0].profile_id)
    }
  }, [cards])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const touchStartX = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 50) {
      delta < 0 ? nextMonth() : prevMonth()
    }
    touchStartX.current = null
  }

  const getCardColor = (cardId: number) => {
    const card = cards.find(c => c.id === cardId)
    return card?.color || '#cbd5e1'
  }

  const handleDateClick = (day: Date) => {
    if (!isSameDay(startOfMonth(day), monthStart)) return
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
        await refreshHistory()
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
        await refreshHistory()
      }
    } catch (err) {
      console.error(err)
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
          const usedCount = history.filter(h => h.card_id === card.id).length
          const remaining = Math.max(0, 3 - usedCount)
          return (
            <div
              key={card.id}
              className="parking-card"
              style={{ borderColor: color, backgroundColor: `${color}10` }}
            >
              <h3 className="user-name" style={{ color }}>{card.user_name}</h3>
              <div
                className="remaining"
                style={{
                  color,
                  transition: 'all 0.3s ease',
                  transform: loading ? 'scale(0.95)' : 'scale(1)',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {remaining}
              </div>
              <div className="remaining-label">회 남음</div>
            </div>
          )
        })}
      </div>

      <div className="calendar-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
            const holidayName = getHolidayName(day)

            let dayClass = 'calendar-day'
            if (!isCurrentMonth) dayClass += ' other-month'
            if (isToday(day)) dayClass += ' today'
            if (isSaturday(day)) dayClass += ' saturday'
            if (isSunday(day) || isHoliday(day)) dayClass += ' sunday'
            if (holidayName) dayClass += ' holiday'

            return (
              <div
                key={day.toISOString()}
                className={dayClass}
                onClick={() => isCurrentMonth && handleDateClick(day)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="day-number">{format(day, 'd')}</span>
                  {holidayName && isCurrentMonth && (
                    <span className="holiday-name">{holidayName}</span>
                  )}
                </div>
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

        {/* 카드 사용 기록 모달 */}
        {isModalOpen && selectedDate && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>{format(selectedDate, 'M월 d일', { locale: ko })} 카드 사용 기록</h3>
              <p className="modal-subtitle">기록할 카드를 선택하세요</p>
              <div className="modal-buttons">
                {cards.map((card) => {
                  const color = card.color || '#cbd5e1'
                  const usedCount = history.filter(h => h.card_id === card.id).length
                  const remaining = Math.max(0, 3 - usedCount)
                  return (
                    <button
                      key={card.id}
                      className="modal-use-button"
                      style={{ borderColor: color }}
                      onClick={() => handleUseCard(card.id)}
                      disabled={loading || remaining <= 0}
                    >
                      <span className="button-user-name" style={{ color }}>{card.user_name}</span>
                      <span className="button-remaining" style={{ transition: 'all 0.3s ease' }}>
                        ({remaining}회 남음)
                      </span>
                    </button>
                  )
                })}
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>닫기</button>
            </div>
          </div>
        )}

        {/* 사용 기록 수정/삭제 모달 */}
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
    </>
  )
}
