'use client'

import { useState, useEffect } from 'react'
import { addParkingCard, deleteParkingCard, updateParkingCard, checkAutoReset } from '../actions'

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
  activeProfileId?: number
}

const PRESET_COLORS = [
  '#3b82f6', '#ec4899', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1'
]

export default function ManageClient({ cards, profiles, activeProfileId }: ManageClientProps) {
  const [newUserName, setNewUserName] = useState('')
  const [newColor, setNewColor] = useState('')
  const [showColorPopup, setShowColorPopup] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Edit state
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [editRemainingUses, setEditRemainingUses] = useState(0)
  const [editColor, setEditColor] = useState('')
  const [showEditColorPopup, setShowEditColorPopup] = useState(false)

  useEffect(() => {
    if (activeProfileId) {
      checkAutoReset(activeProfileId)
    }
  }, [activeProfileId])

  const usedColors = cards.map(c => c.color.toLowerCase())

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserName.trim() || !newColor || loading || !activeProfileId) return
    
    setLoading(true)
    try {
      const result = await addParkingCard(newUserName.trim(), activeProfileId, newColor)
      if (!result.success) {
        alert(result.error)
      } else {
        setNewUserName('')
        setNewColor('')
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
    setEditColor(card.color || PRESET_COLORS[0])
  }

  const handleEditCancel = () => {
    setEditingCardId(null)
  }

  const handleEditSave = async (id: number) => {
    if (!editUserName.trim() || !editColor || loading || !activeProfileId) return

    setLoading(true)
    try {
      const result = await updateParkingCard(id, editUserName.trim(), editRemainingUses, activeProfileId, editColor)
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
        {!activeProfileId ? (
          <p className="warning-msg">카드를 추가하려면 상단에서 특정 프로필을 먼저 선택해 주세요.</p>
        ) : (
          <form onSubmit={handleAdd} className="add-card-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <input 
                  type="text" 
                  value={newUserName} 
                  onChange={(e) => setNewUserName(e.target.value)} 
                  placeholder="카드 별칭 (예: 신한플래티넘)" 
                  disabled={loading}
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowColorPopup(true)}
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '0.5rem', 
                    backgroundColor: newColor || '#e2e8f0', 
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer'
                  }}
                  title="색상 선택"
                />
                <button type="submit" disabled={loading || !newUserName.trim() || !newColor} className="add-button">
                  추가
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {showColorPopup && (
        <div className="modal-overlay" onClick={() => setShowColorPopup(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px' }}>
            <h3>색상 선택</h3>
            <p className="modal-subtitle">중복되지 않는 색상을 선택하세요</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem' }}>
              {PRESET_COLORS.map(color => {
                const isUsed = usedColors.includes(color.toLowerCase())
                return (
                  <button
                    key={color}
                    onClick={() => {
                      if (!isUsed) {
                        setNewColor(color)
                        setShowColorPopup(false)
                      }
                    }}
                    disabled={isUsed}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: newColor === color ? '3px solid #000' : 'none',
                      opacity: isUsed ? 0.2 : 1,
                      cursor: isUsed ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  />
                )
              })}
            </div>
            <button className="modal-close" onClick={() => setShowColorPopup(false)}>취소</button>
          </div>
        </div>
      )}

      <div className="manage-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>등록된 카드 목록</h2>
        </div>
        {cards.length === 0 ? (
          <p className="empty-msg">이 프로필에 등록된 카드가 없습니다.</p>
        ) : (
          <ul className="card-list">
            {cards.map(card => (
              <li key={card.id} className="card-list-item">
                {editingCardId === card.id ? (
                  <div className="edit-form" style={{ width: '100%', gap: '1rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                      <input 
                        type="text" 
                        value={editUserName} 
                        onChange={(e) => setEditUserName(e.target.value)}
                        className="input-field edit-name"
                        style={{ flex: 2 }}
                        placeholder="이름"
                      />
                      <input 
                        type="number" 
                        value={editRemainingUses} 
                        onChange={(e) => setEditRemainingUses(Number(e.target.value))}
                        className="input-field edit-uses"
                        min="0"
                        style={{ flex: 1 }}
                        placeholder="횟수"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowEditColorPopup(true)}
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '0.5rem', 
                          backgroundColor: editColor, 
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    <div className="edit-actions" style={{ marginTop: '0.5rem' }}>
                      <button onClick={() => handleEditSave(card.id)} disabled={loading} className="save-button">저장</button>
                      <button onClick={handleEditCancel} disabled={loading} className="cancel-button">취소</button>
                    </div>

                    {showEditColorPopup && (
                      <div className="modal-overlay" onClick={() => setShowEditColorPopup(false)} style={{ zIndex: 1100 }}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px' }}>
                          <h3>색상 수정</h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem' }}>
                            {PRESET_COLORS.map(color => {
                              // Can use current card's color
                              const isUsedByOthers = cards.some(c => c.id !== card.id && c.color.toLowerCase() === color.toLowerCase())
                              return (
                                <button
                                  key={color}
                                  onClick={() => {
                                    if (!isUsedByOthers) {
                                      setEditColor(color)
                                      setShowEditColorPopup(false)
                                    }
                                  }}
                                  disabled={isUsedByOthers}
                                  style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    border: editColor === color ? '3px solid #000' : 'none',
                                    opacity: isUsedByOthers ? 0.2 : 1,
                                    cursor: isUsedByOthers ? 'not-allowed' : 'pointer'
                                  }}
                                />
                              )
                            })}
                          </div>
                          <button className="modal-close" onClick={() => setShowEditColorPopup(false)}>취소</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="profile-info">
                      <div className="profile-color-dot" style={{ backgroundColor: card.color || '#cbd5e1' }}></div>
                      <div>
                        <div className="card-list-name">{card.user_name} <small>({card.remaining_uses}회 남음)</small></div>
                        {!activeProfileId && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>소유자: {getProfileName(card.profile_id)}</div>}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button 
                        onClick={() => handleEditStart(card)}
                        disabled={loading || !activeProfileId}
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
