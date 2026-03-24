'use client'

import { useState } from 'react'
import { addReport } from '../actions'
import { useRouter } from 'next/navigation'

interface ReportClientProps {
  activeProfileId?: number
  activeProfileName?: string
}

export default function ReportClient({ activeProfileId, activeProfileName }: ReportClientProps) {
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || loading) return

    setLoading(true)
    try {
      const result = await addReport(activeProfileId || null, type, content.trim())
      if (result.success) {
        alert('소중한 의견 감사합니다! 성공적으로 제출되었습니다. ✨')
        router.push('/')
      } else {
        alert(result.error)
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="manage-section">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>작성자</label>
          <div style={{ 
            padding: '0.75rem', 
            background: '#f1f5f9', 
            borderRadius: '0.5rem', 
            fontSize: '0.9rem',
            color: '#475569'
          }}>
            {activeProfileName ? `${activeProfileName} (현재 프로필)` : '익명'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>유형 선택</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setType('bug')}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '2px solid',
                borderColor: type === 'bug' ? '#ef4444' : '#e2e8f0',
                background: type === 'bug' ? '#fef2f2' : 'white',
                color: type === 'bug' ? '#ef4444' : '#64748b',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🐞 버그 제보
            </button>
            <button
              type="button"
              onClick={() => setType('feature')}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '2px solid',
                borderColor: type === 'feature' ? '#3b82f6' : '#e2e8f0',
                background: type === 'feature' ? '#eff6ff' : 'white',
                color: type === 'feature' ? '#3b82f6' : '#64748b',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              💡 기능 제안
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>상세 내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력해 주세요..."
            required
            rows={6}
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none'
            }}
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !content.trim()}
          style={{
            padding: '1rem',
            background: loading ? '#94a3b8' : '#1e293b',
            color: 'white',
            border: 'none',
            borderRadius: '0.75rem',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            marginTop: '0.5rem'
          }}
        >
          {loading ? '제출 중...' : '소중한 의견 보내기'}
        </button>
      </form>
    </div>
  )
}
