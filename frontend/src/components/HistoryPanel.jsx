import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Calendar } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const HistoryPanel = ({ onUnmount }) => {
  const [historyList, setHistoryList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  
  const todayStr = () => new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line
  }, []);

  const fetchHistory = async () => {
    setLoadingList(true);
    try {
      const res = await axios.get(`${API_URL}/lunches/history`, {
        params: { from: dateFrom, to: dateTo }
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
      Nombre: `${r.nombres} ${r.paterno}`,
      Curso: r.nombre_curso || 'S/C',
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
      <div className="date-range">
        <div className="date-field">
          <label>Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="date-field">
          <label>Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button className="date-search-btn" onClick={fetchHistory}>
          <Calendar size={16} /> Buscar
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
          No hay registros en estas fechas.
        </p>
      ) : (
        <div className="registrations-list">
          {historyList.map((reg) => (
            <div key={reg.id_registro} className={`registration-card ${expandedId === reg.id_registro ? 'expanded' : ''}`}>
              <div className="registration-card-header" onClick={() => setExpandedId(expandedId === reg.id_registro ? null : reg.id_registro)}>
                <div className="registration-info">
                  <h4>{reg.nombres} {reg.paterno}</h4>
                  <p>{reg.rut} • {reg.nombre_curso || 'N/A'}</p>
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
