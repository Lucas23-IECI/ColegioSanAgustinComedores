import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Users, LogOut, ChevronRight } from 'lucide-react';
import { AuthContext } from './context/AuthContext';

const modules = [
  {
    key: 'alimentacion',
    icon: Utensils,
    title: 'Alimentación (Junaeb)',
    description: 'Reportes de asistencia del comedor y anomalías (Asistente Social).',
    path: '/admin/alimentacion',
    color: '#4F46E5',
    bg: 'rgba(79, 70, 229, 0.08)',
  },
  {
    key: 'estudiantes',
    icon: Users,
    title: 'Gestor Estudiantes',
    description: 'Padrón completo, filtros por curso y perfiles detallados familiares.',
    path: '/admin/estudiantes',
    color: '#7C3AED',
    bg: 'rgba(124, 58, 237, 0.08)',
  },
];

const AdminHub = () => {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="hub-page">
      <div className="hub-card">
        <header className="hub-header">
          <div>
            <h1 className="hub-title">Hub Administrativo</h1>
            <p className="hub-welcome">
              Bienvenido, <strong>{user?.correo}</strong>
            </p>
          </div>
          <button onClick={handleLogout} className="hub-logout">
            <LogOut size={18} />
            <span>Salir</span>
          </button>
        </header>

        <p className="hub-prompt">Selecciona el módulo al que deseas acceder:</p>

        <div className="hub-grid">
          {modules.map((mod) => (
            <button
              key={mod.key}
              className="hub-module"
              onClick={() => navigate(mod.path)}
            >
              <div className="hub-module-icon" style={{ background: mod.bg, color: mod.color }}>
                <mod.icon size={28} />
              </div>
              <h3 className="hub-module-title">{mod.title}</h3>
              <p className="hub-module-desc">{mod.description}</p>
              <span className="hub-module-go" style={{ color: mod.color }}>
                Acceder <ChevronRight size={16} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminHub;
