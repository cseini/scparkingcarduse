'use client'

import { useState } from 'react'
import { addProfile, updateProfile, deleteProfile } from './actions'
import { useToast } from './Toast'

interface Profile {
  id: number
  name: string
}

interface ProfileManagerModalProps {
  profiles: Profile[]
  onClose: () => void
}

export default function ProfileManagerModal({ profiles, onClose }: ProfileManagerModalProps) {
  const { showToast } = useToast()
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPin, setEditPin] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || newPin.length !== 4 || loading) return
    setLoading(true)
    try {
      const result = await addProfile(newName.trim(), newPin)
      if (result.success) {
        showToast('새 프로필이 생성되었습니다.', 'success')
        setNewName('')
        setNewPin('')
      } else {
        showToast(result.error || '추가 실패', 'error')
      }
    } catch (err) {
      showToast('오류가 발생했습니다.', 'error')
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
        showToast(result.error || '삭제 실패', 'error')
      } else {
        showToast('프로필이 삭제되었습니다.', 'success')
      }
    } catch (err) {
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEditSave = async (id: number) => {
    if (!editName.trim() || loading) return
    if (editPin && editPin.length !== 4) {
      showToast('핀코드는 4자리여야 합니다.', 'error')
      return
    }
    setLoading(true)
    try {
      const result = await updateProfile(id, editName.trim(), editPin || undefined)
      if (result.success) {
        showToast('프로필 정보가 수정되었습니다.', 'success')
        setEditingId(null)
        setEditPin('')
      } else {
        showToast(result.error || '수정 실패', 'error')
      }
    } catch (err) {
      showToast('오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>프로필 관리</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder="프로필 이름" 
              className="input-field"
              disabled={loading}
            />
            <input 
              type="password" 
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={newPin} 
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))} 
              placeholder="PIN (4자리)" 
              className="input-field"
              style={{ width: '100px' }}
              disabled={loading}
            />
          </div>
          <button type="submit" className="add-button" disabled={loading || !newName.trim() || newPin.length !== 4}>
            프로필 추가
          </button>
        </form>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {profiles.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center' }}>등록된 프로필이 없습니다.</p>
          ) : (
            <ul className="card-list" style={{ padding: 0, listStyle: 'none' }}>
              {profiles.map(p => (
                <li key={p.id} className="card-list-item" style={{ padding: '0.75rem', flexDirection: 'column', alignItems: 'stretch' }}>
                  {editingId === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)}
                          className="input-field"
                          placeholder="이름"
                        />
                        <input 
                          type="password" 
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={editPin} 
                          onChange={(e) => setEditPin(e.target.value.replace(/[^0-9]/g, ''))}
                          className="input-field"
                          placeholder="새 PIN"
                          style={{ width: '100px' }}
                        />
                      </div>
                      <div className="edit-actions">
                        <button onClick={() => handleEditSave(p.id)} className="save-button">저장</button>
                        <button onClick={() => { setEditingId(null); setEditPin(''); }} className="cancel-button">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <div className="card-actions">
                        <button onClick={() => { setEditingId(p.id); setEditName(p.name); }} className="edit-button">수정</button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="delete-button">삭제</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="modal-close" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}