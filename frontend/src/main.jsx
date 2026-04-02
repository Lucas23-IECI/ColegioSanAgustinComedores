import { StrictMode, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, AuthContext } from './context/AuthContext'
import App from './App.jsx'
import Students from './Students.jsx'
import Login from './Login.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import AdminHub from './AdminHub.jsx'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const RoleBasedHome = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  
  if (user.rol === 'admin') {
      return <Navigate to="/admin" />;
  }
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleBasedHome />} />
          
          {/* Lector Only (Opcional admin test) */}
          <Route path="/scanner" element={<ProtectedRoute allowedRoles={['lector', 'admin']}><App /></ProtectedRoute>} />
          
          {/* Admin Tree */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminHub /></ProtectedRoute>} />
          <Route path="/admin/alimentacion" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/estudiantes" element={<ProtectedRoute allowedRoles={['admin']}><Students /></ProtectedRoute>} />
          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
)
