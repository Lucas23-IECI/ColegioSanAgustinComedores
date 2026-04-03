import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './context/AuthContext';
import { Users, AlertTriangle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HistoryPanel from './components/HistoryPanel';

const AdminDashboard = () => {
  const [reporte, setReporte] = useState([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReporte();
  }, []);

  const fetchReporte = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/reportes/recurrentes');
      setReporte(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <div className="glass-panel" style={{maxWidth: '800px', width: '100%'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
          <h2 style={{color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Users /> Panel de Administrador (WIP)
          </h2>
          <div style={{display: 'flex', gap: '10px'}}>
            <button onClick={() => navigate('/admin')} className="action-btn" style={{backgroundColor: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.2)', color: 'var(--primary)'}}>
              Volver al Hub
            </button>
            <button onClick={handleLogout} className="action-btn delete" style={{display: 'flex', gap: '4px'}}>
              <LogOut size={16}/> Salir
            </button>
          </div>
        </div>

        <div className="alert warning" style={{marginBottom: '1rem', display: 'flex', gap: '10px', alignItems: 'center'}}>
          <AlertTriangle size={24} />
          <span>
            <strong>Reporte Asistente Social:</strong> Listado de alumnos NO beneficiarios que
            han utilizado el servicio de alimentación, ordenados por nivel de recurrencia.
          </span>
        </div>

        {loading ? (
          <div className="loader">Cargando reporte...</div>
        ) : reporte.length === 0 ? (
          <p style={{color: 'var(--text-light)', textAlign: 'center'}}>No hay registros anómalos actualmente.</p>
        ) : (
          <table style={{width: '100%', color: 'var(--text-dark)', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '1px solid rgba(0,0,0,0.1)'}}>
                <th style={{padding: '10px', textAlign: 'left'}}>RUT</th>
                <th style={{padding: '10px', textAlign: 'left'}}>Alumno</th>
                <th style={{padding: '10px', textAlign: 'left'}}>Curso</th>
                <th style={{padding: '10px', textAlign: 'center'}}>Total Consumos</th>
              </tr>
            </thead>
            <tbody>
              {reporte.map((fila, index) => (
                <tr key={index} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                  <td style={{padding: '10px'}}>{fila.rut}</td>
                  <td style={{padding: '10px'}}>{fila.nombres} {fila.paterno}</td>
                  <td style={{padding: '10px'}}>{fila.nombre_curso || 'N/A'}</td>
                  <td style={{padding: '10px', textAlign: 'center', fontWeight: 'bold'}}>{fila.total_consumos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '2rem 0' }} />
        
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Historial Completo de Registros</h3>
          <HistoryPanel />
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
