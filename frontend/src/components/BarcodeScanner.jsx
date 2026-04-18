import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, CheckCircle, AlertCircle, Utensils, Coffee, Zap, ZapOff, Activity, User, ChevronRight, Columns, AlignCenter, Sparkles, ShieldCheck, GraduationCap, Clock, Filter, X } from 'lucide-react';
import { playBeep } from '../utils/audioNotifier';
import { API_URL } from '../config';

function getAutoMealType() {
  const hour = new Date().getHours();
  return hour < 13 ? 'desayuno' : 'almuerzo';
}

function getAutoMealLabel() {
  return getAutoMealType() === 'desayuno' ? 'Desayuno' : 'Almuerzo';
}

// Horarios de servicio
function getMealSchedule() {
  const type = getAutoMealType();
  if (type === 'desayuno') return { start: '07:30', end: '09:30', label: 'Servicio Desayuno' };
  return { start: '12:30', end: '14:30', label: 'Servicio Almuerzo' };
}

function getTimeRemaining() {
  const now = new Date();
  const schedule = getMealSchedule();
  const [eh, em] = schedule.end.split(':').map(Number);
  const endMin = eh * 60 + em;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const diff = endMin - nowMin;
  if (diff <= 0) return 'Servicio finalizado';
  if (diff > 60) return `${Math.floor(diff / 60)}h ${diff % 60}min restantes`;
  return `${diff} min restantes`;
}

const BarcodeScanner = () => {
  const [inputValue, setInputValue] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [esBeneficiario, setEsBeneficiario] = useState(true);
  const [restricciones, setRestricciones] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [todayStats, setTodayStats] = useState({ total: 0, beneficiarios: 0, noBeneficiarios: 0 });
  
  // Layout mode: 'centered' | 'columns'
  const [layoutMode, setLayoutMode] = useState('centered');
  
  // Flash mode feedback
  const [flashMode, setFlashMode] = useState(false);
  const [flashColor, setFlashColor] = useState(null);
  
  // Advanced search filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterCurso, setFilterCurso] = useState('');
  const [courses, setCourses] = useState([]);
  
  // Búsqueda manual
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Scanner status — solo indicador, NUNCA bloquea el input
  const [scannerActive, setScannerActive] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  
  // Confirmación antes de registro (flujo escáner)
  const [pendingRegistration, setPendingRegistration] = useState(null);
  
  // Detección de escáner vs teclado manual
  const keystrokeTimestamps = useRef([]);
  const scannerThreshold = 80;
  const lastScannerDetection = useRef(0);
  
  const inputRef = useRef(null);
  const autoResetTimer = useRef(null);
  const searchDebounce = useRef(null);
  const isProcessing = useRef(false);
  const overrideTimer = useRef(null);
  const pendingTimer = useRef(null);
  const searchResultRefs = useRef([]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  
  // Fetch today's stats — usa endpoint optimizado
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_URL}/lunches/today-stats`);
        setTodayStats(res.data);
        setTodayCount(res.data.total || 0);
      } catch { setTodayCount(0); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch courses for filter
  useEffect(() => {
    axios.get(`${API_URL}/courses`).then(r => setCourses(r.data || [])).catch(() => {});
  }, []);

  // Keep focus on input (kiosk mode) — solo si no hay otro elemento interactivo activo
  useEffect(() => {
    const refocus = () => {
      if (!showResults && (document.activeElement === document.body || document.activeElement === inputRef.current)) {
        inputRef.current?.focus();
      }
    };
    const interval = setInterval(refocus, 2000);
    return () => clearInterval(interval);
  }, [showResults]);

  // Auto-detect scanner inactive
  useEffect(() => {
    if (manualOverride) return;
    const interval = setInterval(() => {
      if (Date.now() - lastScannerDetection.current > 10000) {
        setScannerActive(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [manualOverride]);

  const resetState = useCallback(() => {
    setInputValue('');
    setStudent(null);
    setError('');
    setSuccessMsg('');
    setAlreadyRegistered(false);
    setRestricciones([]);
    setEsBeneficiario(true);
    setSearchResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
    setPendingRegistration(null);
    clearTimeout(pendingTimer.current);
    keystrokeTimestamps.current = [];
    inputRef.current?.focus();
  }, []);

  // Auto-reset after feedback (pero NO si hay undo activo — mantener más tiempo)
  useEffect(() => {
    if (successMsg || error || (alreadyRegistered && !successMsg)) {
      autoResetTimer.current = setTimeout(resetState, 4000);
    }
    return () => clearTimeout(autoResetTimer.current);
  }, [successMsg, error, alreadyRegistered, resetState]);

  const isScannerInput = () => {
    const stamps = keystrokeTimestamps.current;
    if (stamps.length < 3) return false;
    let totalGap = 0;
    for (let i = 1; i < stamps.length; i++) {
      totalGap += stamps[i] - stamps[i - 1];
    }
    const avgGap = totalGap / (stamps.length - 1);
    return avgGap < scannerThreshold;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (pendingRegistration) {
        clearTimeout(pendingTimer.current);
        setPendingRegistration(null);
        setStudent(null);
        setLoading(false);
        isProcessing.current = false;
        inputRef.current?.focus();
        return;
      }
      resetState();
      return;
    }
    
    // Navegación por teclado en dropdown
    if (showResults && searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = Math.min(prev + 1, searchResults.length - 1);
          searchResultRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = Math.max(prev - 1, -1);
          if (next >= 0) searchResultRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        return;
      }
    }
    
    keystrokeTimestamps.current.push(Date.now());
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setSelectedIndex(-1);
    
    clearTimeout(searchDebounce.current);
    
    if (val.trim().length >= 2) {
      searchDebounce.current = setTimeout(async () => {
        if (!isScannerInput() && val.trim().length >= 2) {
          try {
            const res = await axios.get(`${API_URL}/students/search`, { params: { q: val.trim() } });
            setSearchResults(res.data);
            setShowResults(res.data.length > 0);
          } catch { setSearchResults([]); setShowResults(false); }
        }
      }, 350);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const value = inputValue.trim();
    if (!value || isProcessing.current) return;
    
    clearTimeout(searchDebounce.current);
    
    // Si hay dropdown abierto y un item seleccionado con flechas, seleccionarlo
    if (showResults && selectedIndex >= 0 && searchResults[selectedIndex]) {
      await handleSelectStudent(searchResults[selectedIndex]);
      return;
    }
    
    const wasScanner = isScannerInput();
    
    if (wasScanner) {
      if (!manualOverride) setScannerActive(true);
      lastScannerDetection.current = Date.now();
      setShowResults(false);
      setSearchResults([]);
      await scanByBarcode(value);
    } else {
      setShowResults(false);
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/students/search`, { params: { q: value } });
        if (res.data.length === 1) {
          await handleSelectStudent(res.data[0]);
        } else if (res.data.length > 1) {
          setSearchResults(res.data);
          setShowResults(true);
          setLoading(false);
        } else {
          setError('No se encontraron alumnos con esa búsqueda.');
          playBeep('error');
          setInputValue('');
          setLoading(false);
        }
      } catch {
        setError('Error de conexión con el servidor.');
        playBeep('error');
        setLoading(false);
      }
    }
    
    keystrokeTimestamps.current = [];
  };

  // Flujo escáner: buscar → mostrar confirmación 2s → registrar automáticamente
  const scanByBarcode = async (barcode) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    setInputValue('');
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setStudent(null);
    setAlreadyRegistered(false);
    setRestricciones([]);

    const mealType = getAutoMealType();

    try {
      const res = await axios.get(`${API_URL}/students/scan/${encodeURIComponent(barcode)}`, {
        params: { tipo_alimentacion: mealType }
      });
      
      const foundStudent = res.data.alumno;
      const isAlreadyReg = res.data.alreadyRegistered;

      setStudent(foundStudent);
      setAlreadyRegistered(isAlreadyReg);
      setEsBeneficiario(res.data.esBeneficiario);
      setRestricciones(res.data.restricciones || []);
      setLoading(false);

      if (!isAlreadyReg) {
        // Mostrar confirmación 2 segundos antes de registrar
        setPendingRegistration({ student: foundStudent, benefStatus: res.data.esBeneficiario, mealType });
        pendingTimer.current = setTimeout(async () => {
          setPendingRegistration(null);
          await registerMeal(foundStudent, res.data.esBeneficiario, mealType);
          isProcessing.current = false;
        }, 2000);
      } else {
        triggerFlash('warning');
        playBeep('warning');
        isProcessing.current = false;
      }
    } catch (err) {
      if (err.response && err.response.status === 403) {
        setError(err.response.data.message);
      } else if (err.response && err.response.status === 404) {
        setError('Código no encontrado en el sistema.');
      } else {
        setError('Error de conexión con el servidor.');
      }
      triggerFlash('error');
      playBeep('error');
      setLoading(false);
      isProcessing.current = false;
    }
  };

  const handleSelectStudent = async (s) => {
    setShowResults(false);
    setSearchResults([]);
    setInputValue('');
    setSelectedIndex(-1);
    
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setStudent(null);
    setAlreadyRegistered(false);
    setRestricciones([]);

    const mealType = getAutoMealType();

    try {
      const res = await axios.get(`${API_URL}/students/${s.id_alumno}/status`, {
        params: { tipo_alimentacion: mealType }
      });
      
      const foundStudent = res.data.alumno;
      const isAlreadyReg = res.data.alreadyRegistered;

      setStudent(foundStudent);
      setAlreadyRegistered(isAlreadyReg);
      setEsBeneficiario(res.data.esBeneficiario);
      setRestricciones(res.data.restricciones || []);

      if (!isAlreadyReg) {
        await registerMeal(foundStudent, res.data.esBeneficiario, mealType);
      } else {
        playBeep('warning');
      }
    } catch (err) {
      if (err.response && err.response.status === 403) {
        setError(err.response.data.message);
      } else if (err.response && err.response.status === 404) {
        setError('Alumno no encontrado.');
      } else {
        setError('Error de conexión con el servidor.');
      }
      playBeep('error');
    } finally {
      setLoading(false);
      isProcessing.current = false;
    }
  };

  const registerMeal = async (studentData, benefStatus, mealType) => {
    try {
      const res = await axios.post(`${API_URL}/lunches`, {
        id_alumno: studentData.id_alumno,
        tipo_alimentacion: mealType
      });
      const label = benefStatus ? 'Beneficiario' : 'Uso Registrado';
      setSuccessMsg(`${studentData.nombres} ${studentData.paterno} — ${label}`);
      setAlreadyRegistered(true);
      setTodayCount(prev => prev + 1);
      setTodayStats(prev => ({
        ...prev,
        total: prev.total + 1,
        beneficiarios: benefStatus ? prev.beneficiarios + 1 : prev.beneficiarios,
        noBeneficiarios: !benefStatus ? prev.noBeneficiarios + 1 : prev.noBeneficiarios
      }));
      triggerFlash('success');
      playBeep('success');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setAlreadyRegistered(true);
        setSuccessMsg('');
        triggerFlash('warning');
        playBeep('warning');
      } else {
        setError('Error al registrar. Intenta nuevamente.');
        triggerFlash('error');
        playBeep('error');
      }
    }
  };

  const triggerFlash = (type) => {
    if (!flashMode) return;
    const colors = { success: 'flash-green', error: 'flash-red', warning: 'flash-yellow' };
    setFlashColor(colors[type] || null);
    setTimeout(() => setFlashColor(null), 800);
  };

  // Toggle manual del scanner — con cleanup del timeout anterior
  const handleToggleScanner = () => {
    clearTimeout(overrideTimer.current);
    setManualOverride(true);
    setScannerActive(prev => !prev);
    overrideTimer.current = setTimeout(() => setManualOverride(false), 30000);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearTimeout(overrideTimer.current);
      clearTimeout(pendingTimer.current);
      clearTimeout(searchDebounce.current);
    };
  }, []);

  // Filter search results by course if filter active
  const filteredSearchResults = filterCurso
    ? searchResults.filter(s => s.nombre_curso === filterCurso)
    : searchResults;

  const schedule = getMealSchedule();
  const timeRemaining = getTimeRemaining();

  // Feedback content (reused in both layouts)
  const feedbackContent = (
    <>
      {/* Pending confirmation (scanner flow) */}
      {pendingRegistration && (
        <div className="kiosk-feedback kiosk-pending fade-in">
          <div className="kiosk-pending-spinner" />
          <div className="kiosk-feedback-text">
            Registrando a {pendingRegistration.student.nombres} {pendingRegistration.student.paterno}...
          </div>
          <div className="kiosk-feedback-sub">{pendingRegistration.student.rut}-{pendingRegistration.student.dv} • {pendingRegistration.student.nombre_curso || 'Sin curso'}</div>
          <div className="kiosk-feedback-meal">Presiona Escape para cancelar</div>
        </div>
      )}

      {/* Loading */}
      {loading && !pendingRegistration && <div className="kiosk-feedback kiosk-loading">Procesando...</div>}

      {/* Success feedback */}
      {successMsg && (
        <div className="kiosk-feedback kiosk-success kiosk-feedback-dramatic fade-in">
          <CheckCircle size={56} className="kiosk-check-anim" />
          <div className="kiosk-feedback-text">{successMsg}</div>
          {student && <div className="kiosk-feedback-sub">{student.rut}-{student.dv} • {student.nombre_curso || 'Sin curso'}</div>}
          <div className="kiosk-feedback-meal">{getAutoMealLabel()}</div>
        </div>
      )}

      {/* Error feedback */}
      {error && (
        <div className="kiosk-feedback kiosk-error kiosk-feedback-dramatic fade-in">
          <AlertCircle size={56} className="kiosk-error-anim" />
          <div className="kiosk-feedback-text">{error}</div>
        </div>
      )}

      {/* Already registered */}
      {student && alreadyRegistered && !successMsg && (
        <div className="kiosk-feedback kiosk-warning kiosk-feedback-dramatic fade-in">
          <AlertCircle size={56} className="kiosk-warning-anim" />
          <div className="kiosk-feedback-text">
            {student.nombres} {student.paterno} — Ya registrado para {getAutoMealLabel()} hoy
          </div>
          <div className="kiosk-feedback-sub">{student.rut}-{student.dv} • {student.nombre_curso || 'Sin curso'}</div>
        </div>
      )}

      {/* Warnings: non-beneficiary + dietary restrictions */}
      {student && !error && !pendingRegistration && (
        <div className="kiosk-warnings">
          {!esBeneficiario && (
            <div className="kiosk-badge kiosk-badge-orange fade-in">
              <AlertCircle size={18} /> No Beneficiario — Uso Registrado
            </div>
          )}
          {restricciones.length > 0 && (
            <div className="kiosk-badge kiosk-badge-red fade-in">
              <Activity size={18} /> Restricción: {restricciones.join(', ')}
            </div>
          )}
        </div>
      )}
    </>
  );

  // Input/search section (reused in both layouts)
  const inputSection = (
    <>
      {/* Scanner status indicator */}
      <div 
        className={`scanner-status ${scannerActive ? 'active' : 'inactive'}`}
        onClick={handleToggleScanner}
        role="button"
        tabIndex={-1}
        title={scannerActive ? 'Escáner detectado — click para cambiar' : 'Sin escáner — click para cambiar'}
      >
        {scannerActive ? <Zap size={16} /> : <ZapOff size={16} />}
        <span>{scannerActive ? 'Escáner Activo' : 'Escáner Desactivado'}</span>
      </div>

      {/* Input field — SIEMPRE funciona */}
      <form onSubmit={handleSubmit} className="kiosk-input-form">
        <div className="kiosk-input-wrapper">
          <Search size={20} className="kiosk-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="kiosk-input"
            placeholder={scannerActive ? 'Esperando escaneo...' : 'RUT o nombre del alumno...'}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
          />
          <button
            type="button"
            className={`kiosk-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(prev => !prev)}
            title="Filtros avanzados"
          >
            <Filter size={16} />
          </button>
        </div>
      </form>

      {/* Advanced filters */}
      {showFilters && (
        <div className="kiosk-filters fade-in">
          <div className="kiosk-filter-row">
            <GraduationCap size={15} />
            <select
              value={filterCurso}
              onChange={(e) => setFilterCurso(e.target.value)}
              className="kiosk-filter-select"
            >
              <option value="">Todos los cursos</option>
              {courses.map(c => (
                <option key={c.id_curso} value={c.nombre_curso}>{c.nombre_curso}</option>
              ))}
            </select>
            {filterCurso && (
              <button className="kiosk-filter-clear" onClick={() => setFilterCurso('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search results dropdown — con keyboard nav */}
      {showResults && filteredSearchResults.length > 0 && (
        <div className="kiosk-search-results" role="listbox">
          {filteredSearchResults.map((s, idx) => (
            <div 
              key={s.id_alumno} 
              ref={el => searchResultRefs.current[idx] = el}
              className={`kiosk-search-item${idx === selectedIndex ? ' selected' : ''}`}
              onClick={() => handleSelectStudent(s)}
              role="option"
              aria-selected={idx === selectedIndex}
            >
              <User size={16} />
              <div className="kiosk-search-item-info">
                <span className="kiosk-search-name">{s.nombres} {s.paterno} {s.materno}</span>
                <span className="kiosk-search-detail">{s.rut}-{s.dv} • {s.nombre_curso || 'Sin curso'}</span>
              </div>
              <ChevronRight size={16} />
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className={`kiosk-scanner ${layoutMode === 'columns' ? 'kiosk-columns' : ''}`}>
      {/* Flash overlay */}
      {flashColor && <div className={`kiosk-flash-overlay ${flashColor}`} />}

      {/* Top bar: turno + controls */}
      <div className="kiosk-topbar">
        <div className="kiosk-turno-badge">
          <Clock size={14} />
          <span>{schedule.start} — {schedule.end}</span>
          <span className="kiosk-turno-remaining">{timeRemaining}</span>
        </div>
        <div className="kiosk-topbar-controls">
          <button
            className={`kiosk-view-btn ${flashMode ? 'active' : ''}`}
            onClick={() => setFlashMode(prev => !prev)}
            title={flashMode ? 'Flash activado' : 'Flash desactivado'}
          >
            <Sparkles size={15} />
          </button>
          <button
            className={`kiosk-view-btn ${layoutMode === 'centered' ? 'active' : ''}`}
            onClick={() => setLayoutMode('centered')}
            title="Vista centrada"
          >
            <AlignCenter size={15} />
          </button>
          <button
            className={`kiosk-view-btn ${layoutMode === 'columns' ? 'active' : ''}`}
            onClick={() => setLayoutMode('columns')}
            title="Vista 2 columnas"
          >
            <Columns size={15} />
          </button>
        </div>
      </div>

      {/* Main content */}
      {layoutMode === 'centered' ? (
        <>
          {inputSection}
          {feedbackContent}
        </>
      ) : (
        <div className="kiosk-columns-grid">
          <div className="kiosk-col-left">
            {inputSection}
          </div>
          <div className="kiosk-col-right">
            {feedbackContent}
            {!loading && !successMsg && !error && !student && !pendingRegistration && (
              <div className="kiosk-col-empty">
                <Utensils size={40} />
                <span>Esperando registro...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="kiosk-stats-bar">
        <div className="kiosk-stat">
          <Utensils size={14} />
          <span>Total hoy: <strong>{todayStats.total}</strong></span>
        </div>
        <div className="kiosk-stat kiosk-stat-benef">
          <ShieldCheck size={14} />
          <span>Beneficiarios: <strong>{todayStats.beneficiarios}</strong></span>
        </div>
        <div className="kiosk-stat kiosk-stat-nobenef">
          <User size={14} />
          <span>No benef.: <strong>{todayStats.noBeneficiarios}</strong></span>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
