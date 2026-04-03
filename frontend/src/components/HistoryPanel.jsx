import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Filter, Calendar } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const HistoryPanel = ({ onUnmount }) => {
  const [historyList, setHistoryList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  
  const todayStr = () => new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());

  const [cursoFiltro, setCursoFiltro] = useState('all');
  const [beneficiarioFiltro, setBeneficiarioFiltro] = useState('all');

  useEffect(() => {
    fetchCourses();
    fetchHistory();
    // eslint-disable-next-line
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`${API_URL}/courses`, { withCredentials: true });
      setCourses(res.data);
    } catch (err) {
      console.error('Error fetching courses', err);
    }
  };

  const setToday = () => {
    setDateFrom(todayStr());
    setDateTo(todayStr());
  };

  const fetchHistory = async () => {
    setLoadingList(true);
    try {
      const res = await axios.get(`${API_URL}/lunches/history`, {
        params: { 
          from: dateFrom, 
          to: dateTo,
          curso: cursoFiltro === 'all' ? '' : cursoFiltro,
          beneficiario: beneficiarioFiltro === 'all' ? '' : beneficiarioFiltro
        },
        withCredentials: true
      });
      setHistoryList(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const exportExcel = async () => {
    if (historyList.length === 0) return;
    const XLSX = await import('xlsx');
    const rows = historyList.map((r) => ({
      RUT: r.rut,
      Apellidos: `${r.paterno} ${r.materno || ''}`.trim(),
      Nombres: r.nombres,
      Curso: r.nombre_curso || 'S/C',
      Correo: r.email || 'N/A',
      'Estado Activo': r.alumno_activo ? 'Activo' : 'Inactivo',
      Comida: r.tipo_alimentacion,
      Beneficiario: r.es_beneficiario_al_momento ? 'Sí' : 'No',
      Fecha: new Date(r.fecha_entrega).toLocaleDateString(),
      Hora: r.hora_entrega
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    XLSX.writeFile(wb, `registros_${dateFrom}_${dateTo}.xlsx`);
  };

  const isMultiDay = dateFrom !== dateTo;

  return (
    <div className="registrations-container fade-in" style={{marginTop: '20px'}}>
      
      {/* Panel de Filtros Moderno */}
      <div className="glass-panel" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div className="date-field">
            <label>Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="date-field">
            <label>Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button className="action-btn" onClick={setToday} style={{ height: '38px', padding: '0 15px', alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            Hoy
          </button>
        </div>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', flexGrow: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '140px', flexGrow: 1 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Curso</label>
            <select 
              value={cursoFiltro} 
              onChange={(e) => setCursoFiltro(e.target.value)} 
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: 'var(--text-dark)', outline: 'none' }}
            >
              <option value="all" style={{color: '#000'}}>Todos los Cursos</option>
              {courses.map(c => (
                <option key={c.id_curso} value={c.nombre_curso} style={{color: '#000'}}>{c.nombre_curso}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '160px', flexGrow: 1 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Beneficiario</label>
            <select 
              value={beneficiarioFiltro} 
              onChange={(e) => setBeneficiarioFiltro(e.target.value)} 
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: 'var(--text-dark)', outline: 'none' }}
            >
              <option value="all" style={{color: '#000'}}>Todos</option>
              <option value="yes" style={{color: '#000'}}>Solo Beneficiarios</option>
              <option value="no" style={{color: '#000'}}>No Benef. (Anomalías)</option>
            </select>
          </div>
        </div>

        <button className="date-search-btn" onClick={fetchHistory} style={{ height: '38px', minWidth: '120px', marginLeft: 'auto' }}>
          <Filter size={16} /> Aplicar
        </button>

      </div>

      <div className="history-header">
        <h3>Total Registrado: {historyList.length}</h3>
        {historyList.length > 0 && (
          <button className="export-btn" onClick={exportExcel}>
            <Download size={14} /> Excel
          </button>
        )}
      </div>

      {loadingList ? (
        <div className="loader">Cargando Historial...</div>
      ) : historyList.length === 0 ? (
        <p style={{textAlign: 'center', color: 'var(--text-light)', marginTop: '10px'}}>
          No hay registros con estos filtros.
        </p>
      ) : (
        <div className="registrations-list">
          {historyList.map((reg) => (
            <div key={reg.id_registro} className={`registration-card ${expandedId === reg.id_registro ? 'expanded' : ''}`}>
              <div className="registration-card-header" onClick={() => setExpandedId(expandedId === reg.id_registro ? null : reg.id_registro)}>
                <div className="registration-info">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {reg.paterno} {reg.materno || ''}, {reg.nombres}
                    {!reg.alumno_activo && <span style={{fontSize: '0.7em', color: '#ff4d4f', border: '1px solid #ff4d4f', padding: '1px 4px', borderRadius: '4px'}}>INACTIVO</span>}
                  </h4>
                  <p>{reg.rut} • {reg.nombre_curso || 'S/C'}</p>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'}}>
                  <span className={`meal-badge ${reg.tipo_alimentacion}`}>
                    {reg.tipo_alimentacion.charAt(0).toUpperCase() + reg.tipo_alimentacion.slice(1)}
                  </span>
                  <span style={{fontSize: '0.75rem', color: 'var(--text-light)'}}>
                    {isMultiDay && <>{new Date(reg.fecha_entrega).toLocaleDateString()} </>} {reg.hora_entrega}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
