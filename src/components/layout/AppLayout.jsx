import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--c-bg)',
      padding: '10px 10px 10px 10px',
      gap: 10,
    }}>
      <Sidebar />
      <main style={{
        flex: 1, minWidth: 0, overflowY: 'auto',
        background: 'var(--c-bg)',
        borderRadius: 12,
      }}>
        <Outlet />
      </main>
    </div>
  )
}
