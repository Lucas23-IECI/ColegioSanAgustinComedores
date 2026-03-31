import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, CheckCircle, AlertCircle, Utensils, Coffee, List, Zap, Trash2, Edit3, Clock, Download, Calendar } from 'lucide-react';
import './index.css';

const API_URL = 'http://localhost:5000/api';

function getAutoMealType() {
  const hour = new Date().getHours();
  return hour < 13 ? 'breakfast' : 'lunch';
}

function formatClock() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.3;

    if (type === 'success') {
      osc.frequency.value = 880;
      osc.type = 'sine';
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'warning') {
      osc.frequency.value = 440;
      osc.type = 'triangle';
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.value = 220;
      osc.type = 'square';
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 220;
      osc2.type = 'square';
      gain2.gain.value = 0.15;
      osc2.start(ctx.currentTime + 0.18);
      osc2.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {}
}

function App() {
  const [rut, setRut] = useState('');
  const [mealType, setMealType] = useState(getAutoMealType);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [scannerRaw, setScannerRaw] = useState('');
  const [scannerMode, setScannerMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [clockTime, setClockTime] = useState(formatClock());
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());

  const inputRef = useRef(null);
  const autoResetTimer = useRef(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setClockTime(formatClock()), 30000);
    return () => clearInterval(interval);
  }, []);

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (successMsg || error || alreadyRegistered) {
      autoResetTimer.current = setTimeout(() => {
        setRut('');
        setStudent(null);
        setError('');
        setSuccessMsg('');
        setAlreadyRegistered(false);
        setScannerRaw('');
        focusInput();
      }, 3000);
    }
    return () => clearTimeout(autoResetTimer.current);
  }, [successMsg, error, alreadyRegistered, focusInput]);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  useEffect(() => {
    if (showHistory && successMsg) fetchHistory();
  }, [successMsg]);

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

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const searchRut = rut.trim();
    if (!searchRut) return;
    if (isProcessing.current) return;
    isProcessing.current = true;

    setScannerRaw(searchRut);
    setRut('');
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setStudent(null);
    setAlreadyRegistered(false);

    try {
      const res = await axios.get(`${API_URL}/students/${encodeURIComponent(searchRut)}`, {
        params: { meal_type: mealType }
      });
      const foundStudent = res.data.student;
      const isAlreadyReg = res.data.alreadyRegistered;

      setStudent(foundStudent);
      setAlreadyRegistered(isAlreadyReg);

      if (scannerMode && !isAlreadyReg) {
        await autoRegister(foundStudent);
      } else if (isAlreadyReg) {
        playBeep('warning');
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('Estudiante no encontrado. Verifica el RUT.');
      } else {
        setError('Error de conexión con el servidor.');
      }
      playBeep('error');
    } finally {
      setLoading(false);
      isProcessing.current = false;
    }
  };

  const autoRegister = async (studentData) => {
    try {
      await axios.post(`${API_URL}/lunches`, {
        student_id: studentData.id,
        meal_type: mealType
      });
      setSuccessMsg(`${studentData.name} registrado!`);
      setAlreadyRegistered(true);
      playBeep('success');
    } catch (err) {
      setError('Error al registrar. Intenta nuevamente.');
      playBeep('error');
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_URL}/lunches`, {
        student_id: student.id,
        meal_type: mealType
      });
      setSuccessMsg(`${student.name} registrado!`);
      setAlreadyRegistered(true);
      playBeep('success');
    } catch (err) {
      setError('Error al registrar. Intenta nuevamente.');
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/lunches/${id}`);
      setConfirmDeleteId(null);
      setExpandedId(null);
      playBeep('success');
      fetchHistory();
    } catch (err) {
      playBeep('error');
    }
  };

  const handleEditMealType = async (id, currentType) => {
    const newType = currentType === 'lunch' ? 'breakfast' : 'lunch';
    try {
      await axios.put(`${API_URL}/lunches/${id}`, { meal_type: newType });
      playBeep('success');
      fetchHistory();
    } catch (err) {
      playBeep('error');
    }
  };

  const exportExcel = async () => {
    if (historyList.length === 0) return;
    const XLSX = await import('xlsx');
    const rows = historyList.map((r) => ({
      Nombre: r.name,
      RUT: r.rut,
      Curso: r.grade,
      Comida: r.meal_type === 'lunch' ? 'Almuerzo' : 'Desayuno',
      Fecha: new Date(r.timestamp).toLocaleDateString(),
      Hora: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    XLSX.writeFile(wb, `registros_${dateFrom}_${dateTo}.xlsx`);
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString();
  };

  const isMultiDay = dateFrom !== dateTo;
  const autoMealLabel = getAutoMealType() === 'breakfast' ? 'Desayuno' : 'Almuerzo';

  return (
    <div className="app-container">
      <div className="glass-panel">
        <header className="header">
          <h1>Registro de Alimentación</h1>
          <div className="header-clock">
            <Clock size={14} />
            <span>{clockTime} — {autoMealLabel}</span>
          </div>
        </header>

        <div
          className={`scanner-badge ${scannerMode ? 'active' : ''}`}
          onClick={() => setScannerMode(!scannerMode)}
        >
          <Zap size={14} />
          {scannerMode ? 'Modo Scanner ON' : 'Modo Scanner OFF'}
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <div className="meal-selector">
            <button
              type="button"
              className={`meal-btn ${mealType === 'breakfast' ? 'active' : ''}`}
              onClick={() => { setMealType('breakfast'); setStudent(null); setError(''); setSuccessMsg(''); }}
            >
              <Coffee size={20} /> Desayuno
            </button>
            <button
              type="button"
              className={`meal-btn ${mealType === 'lunch' ? 'active' : ''}`}
              onClick={() => { setMealType('lunch'); setStudent(null); setError(''); setSuccessMsg(''); }}
            >
              <Utensils size={20} /> Almuerzo
            </button>
          </div>

          <div className="input-group">
            <input
              ref={inputRef}
              type="text"
              placeholder={scannerMode ? 'Escanee código de barras...' : 'Ingrese RUT (ej. 12345678-9)'}
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" disabled={loading} className="search-btn">
              <Search size={20} />
            </button>
          </div>
        </form>

        {scannerRaw && (
          <div className="scanner-raw fade-in">
            <span className="scanner-raw-label">Captura:</span>
            <code>{scannerRaw}</code>
          </div>
        )}

        {loading && <div className="loader">Buscando...</div>}

        {error && (
          <div className="alert error fade-in">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert success fade-in">
            <CheckCircle size={20} />
            <span>{successMsg}</span>
          </div>
        )}

        {student && !successMsg && (
          <div className="student-card fade-in">
            <div className="student-info">
              <h2>{student.name}</h2>
              <p>Curso: <strong>{student.grade}</strong></p>
              <p>RUT: {student.rut}</p>
            </div>
            {alreadyRegistered ? (
              <div className="status-badge warning">
                <AlertCircle size={16} /> Ya registrado para {mealType === 'breakfast' ? 'Desayuno' : 'Almuerzo'} hoy
              </div>
            ) : (
              <button onClick={handleRegister} className="register-btn" disabled={loading}>
                Confirmar Registro
              </button>
            )}
          </div>
        )}

        <button className="toggle-view-btn" onClick={() => setShowHistory(!showHistory)}>
          <List size={18} />
          {showHistory ? 'Ocultar Historial' : 'Ver Historial'}
        </button>

        {showHistory && (
          <div className="registrations-container fade-in">
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
              <h3>
                Total: {historyList.length}
                {loadingList && <span className="loader" style={{marginBottom: 0, fontSize: '0.8rem'}}> (Cargando...)</span>}
              </h3>
              {historyList.length > 0 && (
                <button className="export-btn" onClick={exportExcel}>
                  <Download size={14} /> Excel
                </button>
              )}
            </div>

            {historyList.length === 0 && !loadingList ? (
              <p style={{textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem', marginTop: '10px'}}>
                No hay registros en este rango.
              </p>
            ) : (
              <div className="registrations-list">
                {historyList.map((reg) => (
                  <div key={reg.id} className={`registration-card ${expandedId === reg.id ? 'expanded' : ''}`}>
                    <div className="registration-card-header" onClick={() => {
                      setExpandedId(expandedId === reg.id ? null : reg.id);
                      setConfirmDeleteId(null);
                    }}>
                      <div className="registration-info">
                        <h4>{reg.name}</h4>
                        <p>{reg.rut} • {reg.grade}</p>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'}}>
                        <span className={`meal-badge ${reg.meal_type}`}>
                          {reg.meal_type === 'lunch' ? 'Almuerzo' : 'Desayuno'}
                        </span>
                        <span style={{fontSize: '0.75rem', color: 'var(--text-light)'}}>
                          {isMultiDay && <>{formatDate(reg.timestamp)} </>}{formatTime(reg.timestamp)}
                        </span>
                      </div>
                    </div>

                    {expandedId === reg.id && (
                      <div className="registration-detail fade-in">
                        <div className="detail-row">
                          <span>Nombre:</span> <strong>{reg.name}</strong>
                        </div>
                        <div className="detail-row">
                          <span>RUT:</span> <strong>{reg.rut}</strong>
                        </div>
                        <div className="detail-row">
                          <span>Curso:</span> <strong>{reg.grade}</strong>
                        </div>
                        <div className="detail-row">
                          <span>Comida:</span> <strong>{reg.meal_type === 'lunch' ? 'Almuerzo' : 'Desayuno'}</strong>
                        </div>
                        {isMultiDay && (
                          <div className="detail-row">
                            <span>Fecha:</span> <strong>{formatDate(reg.timestamp)}</strong>
                          </div>
                        )}
                        <div className="detail-row">
                          <span>Hora:</span> <strong>{formatTime(reg.timestamp)}</strong>
                        </div>
                        <div className="detail-actions">
                          <button
                            className="action-btn edit"
                            onClick={() => handleEditMealType(reg.id, reg.meal_type)}
                          >
                            <Edit3 size={14} />
                            Cambiar a {reg.meal_type === 'lunch' ? 'Desayuno' : 'Almuerzo'}
                          </button>
                          {confirmDeleteId === reg.id ? (
                            <div className="confirm-delete">
                              <span>¿Seguro?</span>
                              <button className="action-btn delete" onClick={() => handleDelete(reg.id)}>
                                Sí, eliminar
                              </button>
                              <button className="action-btn cancel" onClick={() => setConfirmDeleteId(null)}>
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              className="action-btn delete"
                              onClick={() => setConfirmDeleteId(reg.id)}
                            >
                              <Trash2 size={14} />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
