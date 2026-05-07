import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import AppLayout from './components/layout/AppLayout'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import Proyectos  from './pages/Proyectos'
import Proyecto   from './pages/Proyecto'
import Nuevo      from './pages/Nuevo'
import Carga      from './pages/Carga'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#13131F' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #F59E0B', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <DataProvider>{children}</DataProvider>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"        element={<Dashboard />} />
            <Route path="proyectos"        element={<Proyectos />} />
            <Route path="proyectos/nuevo"  element={<Nuevo />} />
            <Route path="proyectos/:id"    element={<Proyecto />} />
            <Route path="carga"            element={<Carga />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
