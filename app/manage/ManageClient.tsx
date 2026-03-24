'use client'

import { useState } from 'react'
import { addParkingCard, deleteParkingCard, updateParkingCard } from '../actions'

interface Profile {
  id: number
  name: string
}

interface Card {
  id: number
  user_name: string
  remaining_uses: number
  profile_id: number | null
  color: string
}

interface ManageClientProps {
  cards: Card[]
  profiles: Profile[]
}

const PRESET_COLORS = [
  '#3b82f6', '#ec4899', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1'
]

export default function ManageClient({ cards, profiles }: ManageClientProps) {
  const [newUserName, setNewUserName] = useState('')
  const [newProfileId, setNewProfileId] = useState<number | ''>('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [loading, setLoading] = useState(false)
  
  // Edit state
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [editRemainingUses, setEditRemainingUses] = useState(0)
  const [editProfileId, setEditProfileId] = useState<number | null>(null)
  const [editColor, setEditColor] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserName.trim() || loading) return
    
    setLoading(true)
    try {
      const pId = newProfileId === '' ? null : Number(newProfileId)
      const result = await addParkingCard(newUserName.trim(), pId, newColor)
      if (!result.success) {
        alert(result.error)
      } else {
        setNewUserName('')
        setNewProfileId('')
        setNewColor(PRESET_COLORS[0])
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

  const handleEditStart = (card: Card) => {
    setEditingCardId(card.id)
    setEditUserName(card.user_name)
    setEditRemainingUses(card.remaining_uses)
    setEditProfileId(card.profile_id)
    setEditColor(card.color || PRESET_COLORS[0])
  }

  const handleEditCancel = () => {
    setEditingCardId(null)
  }

  const handleEditSave = async (id: number) => {
    if (!editUserName.trim() || loading) return

    setLoading(true)
    try {
      const result = await updateParkingCard(id, editUserName.trim(), editRemainingUses, editProfileId, editColor)
      if (!result.success) {
        alert(result.error)
      } else {
        setEditingCardId(null)
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getProfileName = (id: number | null) => {
    if (!id) return '공용(프로필 없음)'
    const p = profiles.find(p => p.id === id)
    return p ? p.name : '알 수 없음'
  }

  return (
    <div className="manage-container">
      <div className="manage-section">
        <h2>새 카드 추가</h2>
        <form onSubmit={handleAdd} className="add-card-form" style={{ flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <input 
              type="text" 
              value={newUserName} 
              onChange={(e) => setNewUserName(e.target.value)} 
              placeholder="카드 별칭 (예: 신한플래티넘)" 
              disabled={loading}
              className="input-field"
            />
            <select 
              className="input-field" 
              value={newProfileId}
              onChange={(e) => setNewProfileId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading}
            >
              <option value="">-- 프로필 할당 안 함 --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input 
              type="color" 
              value={newColor} 
              onChange={(e) => setNewColor(e.target.value)} 
              disabled={loading}
              className="color-picker"
              title="카드 표시 색상"
            />
          </div>
          <button type="submit" disabled={loading || !newUserName.trim()} className="add-button" style={{ alignSelf: 'flex-end', width: 'auto' }}>
            카드 추가
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
                {editingCardId === card.id ? (
                  <div className="edit-form" style={{ flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      value={editUserName} 
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="input-field edit-name"
                    />
                    <select 
                      className="input-field edit-name" 
                      value={editProfileId || ''}
                      onChange={(e) => setEditProfileId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">-- 프로필 없음 --</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      value={editRemainingUses} 
                      onChange={(e) => setEditRemainingUses(Number(e.target.value))}
                      className="input-field edit-uses"
                      min="0"
                    />
                    <input 
                      type="color" 
                      value={editColor} 
                      onChange={(e) => setEditColor(e.target.value)}
                      className="color-picker"
                    />
                    <div className="edit-actions">
                      <button onClick={() => handleEditSave(card.id)} disabled={loading} className="save-button">저장</button>
                      <button onClick={handleEditCancel} disabled={loading} className="cancel-button">취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="profile-info">
                      <div className="profile-color-dot" style={{ backgroundColor: card.color || '#cbd5e1' }}></div>
                      <div>
                        <div className="card-list-name">{card.user_name} <small>({card.remaining_uses}회 남음)</small></div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>소유자: {getProfileName(card.profile_id)}</div>
                      </div>
                    </div>
                    <div className="card-actions">
                      <button 
                        onClick={() => handleEditStart(card)}
                        disabled={loading}
                        className="edit-button"
                      >
                        수정
                      </button>
                      <button 
                        onClick={() => handleDelete(card.id, card.user_name)} 
                        disabled={loading}
                        className="delete-button"
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
