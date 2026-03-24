'use client'

import { useState } from 'react'
import { addProfile, updateProfile, deleteProfile } from '../actions'

interface Profile {
  id: number
  name: string
  color: string
}

interface ProfileClientProps {
  profiles: Profile[]
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#10b981', // Green
  '#f59e0b', // Yellow/Orange
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#6366f1', // Violet
]

export default function ProfileClient({ profiles }: ProfileClientProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [loading, setLoading] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || loading) return

    setLoading(true)
    try {
      const result = await addProfile(newName.trim(), newColor)
      if (!result.success) {
        alert(result.error)
      } else {
        setNewName('')
        setNewColor(PRESET_COLORS[0])
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`'${name}' 프로필을 삭제하시겠습니까?`)) return
    
    setLoading(true)
    try {
      const result = await deleteProfile(id)
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

  const handleEditStart = (profile: Profile) => {
    setEditingId(profile.id)
    setEditName(profile.name)
    setEditColor(profile.color)
  }

  const handleEditSave = async (id: number) => {
    if (!editName.trim() || loading) return

    setLoading(true)
    try {
      const result = await updateProfile(id, editName.trim(), editColor)
      if (!result.success) {
        alert(result.error)
      } else {
        setEditingId(null)
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
        <h2>새 프로필 추가</h2>
        <form onSubmit={handleAdd} className="add-card-form">
          <input 
            type="text" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            placeholder="프로필 이름 (예: 나, 와이프)" 
            disabled={loading}
            className="input-field"
          />
          <input 
            type="color" 
            value={newColor} 
            onChange={(e) => setNewColor(e.target.value)} 
            disabled={loading}
            className="color-picker"
            title="색상 선택"
          />
          <button type="submit" disabled={loading || !newName.trim()} className="add-button">
            추가
          </button>
        </form>
        <div className="preset-colors">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`color-preset-btn ${newColor === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
              aria-label="색상 선택"
            />
          ))}
        </div>
      </div>

      <div className="manage-section">
        <h2>등록된 프로필 목록</h2>
        {profiles.length === 0 ? (
          <p className="empty-msg">등록된 프로필이 없습니다.</p>
        ) : (
          <ul className="card-list">
            {profiles.map(profile => (
              <li key={profile.id} className="card-list-item">
                {editingId === profile.id ? (
                  <div className="edit-form">
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field edit-name"
                    />
                    <input 
                      type="color" 
                      value={editColor} 
                      onChange={(e) => setEditColor(e.target.value)}
                      className="color-picker"
                    />
                    <div className="edit-actions">
                      <button onClick={() => handleEditSave(profile.id)} disabled={loading} className="save-button">저장</button>
                      <button onClick={() => setEditingId(null)} disabled={loading} className="cancel-button">취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="profile-info">
                      <div className="profile-color-dot" style={{ backgroundColor: profile.color }}></div>
                      <span className="card-list-name">{profile.name}</span>
                    </div>
                    <div className="card-actions">
                      <button 
                        onClick={() => handleEditStart(profile)}
                        disabled={loading}
                        className="edit-button"
                      >
                        수정
                      </button>
                      <button 
                        onClick={() => handleDelete(profile.id, profile.name)} 
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
