'use client'

import { useState } from 'react'
import { addParkingCard, deleteParkingCard } from '../actions'

interface Card {
  id: number
  user_name: string
  remaining_uses: number
}

interface ManageClientProps {
  cards: Card[]
}

export default function ManageClient({ cards }: ManageClientProps) {
  const [newUserName, setNewUserName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserName.trim() || loading) return
    
    setLoading(true)
    try {
      const result = await addParkingCard(newUserName.trim())
      if (!result.success) {
        alert(result.error)
      } else {
        setNewUserName('')
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, userName: string) => {
    if (!confirm(`'${userName}' 카드를 삭제하시겠습니까?
(사용 이력이 있는 경우 삭제되지 않을 수 있습니다)`)) return
    
    setLoading(true)
    try {
      const result = await deleteParkingCard(id)
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
    <div className="manage-container">
      <div className="manage-section">
        <h2>새 카드 추가</h2>
        <form onSubmit={handleAdd} className="add-card-form">
          <input 
            type="text" 
            value={newUserName} 
            onChange={(e) => setNewUserName(e.target.value)} 
            placeholder="카드 소유자 이름 (예: 동생)" 
            disabled={loading}
            className="input-field"
          />
          <button type="submit" disabled={loading || !newUserName.trim()} className="add-button">
            추가
          </button>
        </form>
      </div>

      <div className="manage-section">
        <h2>등록된 카드 목록</h2>
        {cards.length === 0 ? (
          <p className="empty-msg">등록된 카드가 없습니다.</p>
        ) : (
          <ul className="card-list">
            {cards.map(card => (
              <li key={card.id} className="card-list-item">
                <span className="card-list-name">{card.user_name} <small>({card.remaining_uses}회 남음)</small></span>
                <button 
                  onClick={() => handleDelete(card.id, card.user_name)}
                  disabled={loading}
                  className="delete-button"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
