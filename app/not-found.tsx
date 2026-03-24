export const runtime = 'edge'

export default function NotFound() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      textAlign: 'center',
      padding: '1rem'
    }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>페이지를 찾을 수 없습니다 🅿️</h2>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.</p>
      <a 
        href="/" 
        style={{ 
          padding: '0.75rem 1.5rem', 
          backgroundColor: '#3b82f6', 
          color: 'white', 
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: '600'
        }}
      >
        홈으로 돌아가기
      </a>
    </div>
  )
}
