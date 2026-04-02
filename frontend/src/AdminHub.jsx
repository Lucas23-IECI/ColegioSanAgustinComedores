import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Users, LogOut } from 'lucide-react';
import { AuthContext } from './context/AuthContext';

const AdminHub = () => {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <div className="glass-panel" style={{ maxWidth: '800px', width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--text-dark)' }}>Hub Administrativo</h2>
          <button onClick={handleLogout} className="action-btn cancel" style={{ display: 'flex', gap: '4px' }}>
            <LogOut size={16} /> Salir
          </button>
        </header>

        <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
          Bienvenido, <strong>{user?.correo}</strong>. Selecciona el módulo al que deseas acceder:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }} className="hub-grid">
          
          <div 
            className="registration-card" 
            style={{ padding: '30px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', transition: 'transform 0.2s', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => navigate('/admin/alimentacion')}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '20px', borderRadius: '50%' }}>
              <Utensils size={48} color="var(--primary-color)" />
            </div>
            <h3 style={{ color: 'var(--text-dark)', textAlign: 'center', marginTop: '10px' }}>Alimentación (Junaeb)</h3>
            <p style={{ color: 'var(--text-light)', textAlign: 'center', fontSize: '0.9rem', lineHeight: '1.4' }}>
              Reportes de asistencia del comedor y anomalías (Asistente Social).
            </p>
          </div>

          <div 
            className="registration-card" 
            style={{ padding: '30px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', transition: 'transform 0.2s', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => navigate('/admin/estudiantes')}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '20px', borderRadius: '50%' }}>
              <Users size={48} color="#a855f7" />
            </div>
            <h3 style={{ color: 'var(--text-dark)', textAlign: 'center', marginTop: '10px' }}>Gestor Estudiantes</h3>
            <p style={{ color: 'var(--text-light)', textAlign: 'center', fontSize: '0.9rem', lineHeight: '1.4' }}>
              Padrón completo, filtros por curso y perfiles detallados familiares.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminHub;
