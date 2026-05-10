import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Users, LogOut, ChevronRight, ShieldCheck, UserCog } from 'lucide-react';
import { AuthContext } from './context/AuthContext';

const ALL_MODULES = [
  {
    key: 'alimentacion',
    icon: Utensils,
    title: 'Alimentación (Junaeb)',
    description: 'Reportes de asistencia del comedor y anomalías (Asistente Social).',
    path: '/admin/alimentacion',
    color: '#4F46E5',
    bg: 'rgba(79, 70, 229, 0.08)',
    roles: ['admin', 'asistente_social'],
  },
  {
    key: 'beneficiarios',
    icon: ShieldCheck,
    title: 'Beneficiarios',
    description: 'Alta, edición y carga Excel de beneficiarios con colaciones retroactivas.',
    path: '/admin/beneficiarios',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)',
    roles: ['admin', 'asistente_social'],
  },
  {
    key: 'estudiantes',
    icon: Users,
    title: 'Gestor Estudiantes',
    description: 'Padrón completo, filtros por curso y perfiles detallados familiares.',
    path: '/admin/estudiantes',
    color: '#7C3AED',
    bg: 'rgba(124, 58, 237, 0.08)',
    roles: ['admin'],
  },
  {
    key: 'usuarios',
    icon: UserCog,
    title: 'Gestión de Usuarios',
    description: 'Crear, editar y eliminar cuentas de acceso. Solo administradores.',
    path: '/admin/usuarios',
    color: '#B45309',
    bg: 'rgba(180, 83, 9, 0.08)',
    roles: ['admin'],
  },
];

const AdminHub = () => {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);

  const modules = ALL_MODULES.filter(m => m.roles.includes(user?.rol));

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
          <button className="hub-module hub-module--logout" onClick={handleLogout}>
            <div className="hub-module-icon" style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444' }}>
              <LogOut size={28} />
            </div>
            <h3 className="hub-module-title">Cerrar sesión</h3>
            <p className="hub-module-desc">Salir del sistema de forma segura.</p>
            <span className="hub-module-go" style={{ color: '#EF4444' }}>
              Salir <ChevronRight size={16} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminHub;
