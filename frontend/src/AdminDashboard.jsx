import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './context/AuthContext';
import { 
  Users, AlertTriangle, LogOut, UtensilsCrossed, Coffee, 
  ShieldCheck, ShieldAlert, FileSpreadsheet, Calendar, 
  ChevronDown, Download, RefreshCw, Clock, TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { API_URL } from './config';

const REPORT_TYPES = [
  { id: 'general', label: 'Asistencia General', desc: 'Todos los alumnos — Almuerzo (A) y Desayuno (D) por día', icon: <Users size={18} /> },
  { id: 'almuerzo', label: 'Solo Almuerzo', desc: 'Solo registros de almuerzo con marcas por día', icon: <UtensilsCrossed size={18} /> },
  { id: 'desayuno', label: 'Solo Desayuno', desc: 'Solo registros de desayuno con marcas por día', icon: <Coffee size={18} /> },
  { id: 'no_beneficiarios', label: 'No Beneficiarios JUNAEB', desc: 'Alumnos sin beneficio que consumieron alimentos', icon: <ShieldAlert size={18} /> },
];

const PAGE_SIZE = 20;

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportType, setReportType] = useState('general');
  const [reportFormat, setReportFormat] = useState('detallado'); // 'detallado' | 'resumido'
  const [reportDesde, setReportDesde] = useState('');
  const [reportHasta, setReportHasta] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [registrosHoy, setRegistrosHoy] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Estados de segmentación de reportes
  const [reportScope, setReportScope] = useState('masivo'); // 'masivo' | 'curso' | 'nivel' | 'individual' | 'personalizado'
  const [courses, setCourses] = useState([]);
  const [levels, setLevels] = useState([]);
  const [selectedCursoId, setSelectedCursoId] = useState('');
  const [selectedNivelId, setSelectedNivelId] = useState('');
  
  // Para reporte individual
  const [selectedAlumno, setSelectedAlumno] = useState(null);
  
  // Para reporte personalizado
  const [selectedAlumnos, setSelectedAlumnos] = useState([]);
  
  // Para buscar alumnos
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);

  useEffect(() => {
    // Defaults para este mes
    const now = new Date();
    const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const firstDay = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const today = localDate(now);
    setReportDesde(firstDay);
    setReportHasta(today);
    fetchResumen();
    fetchRegistrosHoy();
  }, []);

  // Cargar cursos y niveles al abrir el panel
  useEffect(() => {
    if (showReportPanel) {
      if (courses.length === 0) {
        axios.get(`${API_URL}/courses`, { withCredentials: true })
          .then(res => setCourses(res.data))
          .catch(err => console.error(err));
      }
      if (levels.length === 0) {
        axios.get(`${API_URL}/levels`, { withCredentials: true })
          .then(res => setLevels(res.data))
          .catch(err => console.error(err));
      }
    }
  }, [showReportPanel]);

  // Búsqueda inteligente de alumnos para reportes individuales/personalizados
  useEffect(() => {
    if (studentSearchTerm.trim().length < 2) {
      setStudentSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingStudents(true);
      try {
        const res = await axios.get(`${API_URL}/students/search`, {
          params: { q: studentSearchTerm },
          withCredentials: true
        });
        setStudentSearchResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [studentSearchTerm]);

  const fetchResumen = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/alimentacion/resumen-dia`);
      setStats(res.data.stats);
      setRecientes(res.data.recientes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrosHoy = async () => {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const res = await axios.get(`${API_URL}/lunches/history`, {
        params: { from: today, to: today }
      });
      setRegistrosHoy(res.data);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const generateReport = async () => {
    if (!reportDesde || !reportHasta) return;

    if (reportScope === 'curso' && !selectedCursoId) {
      alert('Por favor selecciona un curso.');
      return;
    }
    if (reportScope === 'nivel' && !selectedNivelId) {
      alert('Por favor selecciona un nivel.');
      return;
    }
    if (reportScope === 'individual' && !selectedAlumno) {
      alert('Por favor busca y selecciona un alumno.');
      return;
    }
    if (reportScope === 'personalizado' && selectedAlumnos.length === 0) {
      alert('Por favor agrega al menos un alumno al reporte.');
      return;
    }

    setGeneratingReport(true);
    try {
      const params = { desde: reportDesde, hasta: reportHasta, tipo: reportType };
      if (reportScope === 'curso') {
        params.cursoId = selectedCursoId;
      } else if (reportScope === 'nivel') {
        params.nivelId = selectedNivelId;
      } else if (reportScope === 'individual') {
        params.alumnoId = selectedAlumno.id_alumno;
      } else if (reportScope === 'personalizado') {
        params.alumnosIds = selectedAlumnos.map(a => a.id_alumno).join(',');
      }

      const res = await axios.get(`${API_URL}/admin/reportes/asistencia`, {
        params,
        withCredentials: true
      });

      const rawData = res.data;
      if (rawData.length === 0) {
        alert('No se encontraron registros para este período y tipo de reporte.');
        setGeneratingReport(false);
        return;
      }

      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Group raw data by student
      const studentsMap = {};
      rawData.forEach(r => {
        const key = r.id_alumno;
        if (!studentsMap[key]) {
          studentsMap[key] = {
            apellidos: `${r.paterno} ${r.materno || ''}`.trim(),
            nombres: r.nombres,
            curso: r.nombre_curso || 'S/C',
            correo: r.email || '',
            days: {} // { 'YYYY-MM-DD': ['Almuerzo', 'Desayuno'] }
          };
        }
        if (r.fecha_entrega) {
          const dateKey = r.fecha_entrega.substring(0, 10);
          if (!studentsMap[key].days[dateKey]) {
            studentsMap[key].days[dateKey] = [];
          }
          studentsMap[key].days[dateKey].push((r.tipo_alimentacion || '').toString().trim().toLowerCase());
        }
      });

      const students = Object.values(studentsMap);
      students.sort((a, b) => a.apellidos.localeCompare(b.apellidos));

      // Determine months in range
      const startDate = new Date(reportDesde + 'T12:00:00');
      const endDate = new Date(reportHasta + 'T12:00:00');
      const months = [];
      const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cursor <= endDate) {
        months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
        cursor.setMonth(cursor.getMonth() + 1);
      }

      const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const reportLabel = REPORT_TYPES.find(r => r.id === reportType)?.label || 'Reporte';

      if (reportFormat === 'resumido') {
        // === FORMATO RESUMIDO: tabla simple con totales ===
        const titleRow = [`RESUMEN PAE — ${reportLabel.toUpperCase()} — ${reportDesde} a ${reportHasta}`];
        const headerRow = ['N°', 'APELLIDOS', 'NOMBRE', 'CURSO', 'Total Desayunos', 'Total Almuerzos', 'Total Días', 'ESTADO', 'CORREO'];

        const dataRows = students.map((s, idx) => {
          let totalD = 0, totalA = 0;
          const diasUnicos = new Set();
          Object.entries(s.days).forEach(([date, meals]) => {
            diasUnicos.add(date);
            if (meals.includes('desayuno')) totalD++;
            if (meals.includes('almuerzo')) totalA++;
          });
          const estado = diasUnicos.size > 0 ? 'Con consumos' : 'Sin registro';
          return [idx + 1, s.apellidos, s.nombres, s.curso, totalD, totalA, diasUnicos.size, estado, s.correo];
        });

        const aoa = [titleRow, headerRow, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
        ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 15 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, reportLabel.substring(0, 31));

      } else {
        // === FORMATO DETALLADO: marcas D/A por día (PAE estándar) ===
        // Create one sheet per month
        months.forEach(({ year, month }) => {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const monthName = MONTH_NAMES[month];

          const titleRow = [`ASISTENCIA PAE — ${reportLabel.toUpperCase()}`];
          const headerRow1 = ['N°', 'APELLIDOS', 'NOMBRE', 'CURSO'];
          const headerRow2 = ['', '', '', ''];

          for (let d = 1; d <= daysInMonth; d++) {
            headerRow1.push(d, '');
            headerRow2.push('D', 'A');
          }
          headerRow1.push('ESTADO', 'CORREO');
          headerRow2.push('', '');

          const dataRows = students.map((s, idx) => {
            const row = [idx + 1, s.apellidos, s.nombres, s.curso];

            let totalMarcasMes = 0;
            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const meals = s.days[dateStr] || [];
              row.push(meals.includes('desayuno') ? 'X' : '', meals.includes('almuerzo') ? 'X' : '');
              totalMarcasMes += meals.length;
            }

            const estadoMes = totalMarcasMes > 0 ? 'Con consumos' : 'Sin registro';
            row.push(estadoMes);
            row.push(s.correo);
            return row;
          });

          const aoa = [titleRow, headerRow1, headerRow2, ...dataRows];
          const ws = XLSX.utils.aoa_to_sheet(aoa);

          const totalCols = 4 + (daysInMonth * 2) + 2;
          ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }
          ];
          for (let d = 0; d < daysInMonth; d++) {
            const colStart = 4 + (d * 2);
            ws['!merges'].push({ s: { r: 1, c: colStart }, e: { r: 1, c: colStart + 1 } });
          }

          const colWidths = [{ wch: 4 }, { wch: 22 }, { wch: 20 }, { wch: 10 }];
          for (let d = 0; d < daysInMonth; d++) {
            colWidths.push({ wch: 3 }, { wch: 3 });
          }
          colWidths.push({ wch: 15 }, { wch: 30 });
          ws['!cols'] = colWidths;

          const sheetName = months.length === 1
            ? reportLabel.substring(0, 31)
            : `${monthName} ${year}`.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
      }

      let scopeFilename = reportScope;
      if (reportScope === 'curso') {
        const cName = courses.find(c => c.id_curso.toString() === selectedCursoId.toString())?.nombre_curso || selectedCursoId;
        scopeFilename = `curso_${cName.replace(/\s+/g, '_')}`;
      } else if (reportScope === 'nivel') {
        const nName = levels.find(l => l.id_nivel.toString() === selectedNivelId.toString())?.nombre || selectedNivelId;
        scopeFilename = `nivel_${nName.replace(/\s+/g, '_')}`;
      } else if (reportScope === 'individual' && selectedAlumno) {
        scopeFilename = `alumno_${selectedAlumno.paterno}_${selectedAlumno.nombres.split(' ')[0]}`;
      } else if (reportScope === 'personalizado') {
        scopeFilename = `personalizado_${selectedAlumnos.length}_alumnos`;
      }

      XLSX.writeFile(wb, `reporte_${scopeFilename}_${reportType}_${reportFormat}_${reportDesde}_${reportHasta}.xlsx`);

    } catch (err) {
      console.error(err);
      alert('Error al generar el reporte.');
    } finally {
      setGeneratingReport(false);
    }
  };


  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  return (
    <div className="app-container" style={{ maxWidth: '900px' }}>
      <div className="glass-panel" style={{ maxWidth: '100%', width: '100%' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/CSAC-logo_simple.png" alt="Colegio San Agustín" style={{ maxHeight: '44px', width: 'auto', flexShrink: 0 }} />
            <div>
              <h2 style={{ color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UtensilsCrossed /> Módulo Alimentación
              </h2>
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '4px' }}>
              Resumen del día y generación de reportes
            </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/admin/beneficiarios')} className="action-btn" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.2)', color: '#059669' }}>
              Beneficiarios
            </button>
            <button onClick={() => navigate('/admin')} className="action-btn" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.2)', color: 'var(--primary)' }}>
              Volver al Hub
            </button>
            <button onClick={handleLogout} className="action-btn delete" style={{ display: 'flex', gap: '4px' }}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </header>

        {/* ===== SECCIÓN 1: RESUMEN DEL DÍA ===== */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} /> Resumen de Hoy
            </h3>
            <button 
              onClick={() => { fetchResumen(); fetchRegistrosHoy(); }}
              className="action-btn" 
              style={{ background: 'rgba(79,70,229,0.07)', color: 'var(--primary)', border: 'none' }}
              title="Recargar"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div className="loader">Cargando resumen...</div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="stats-grid">
                <div className="stat-card stat-card--almuerzo">
                  <div className="stat-card__icon"><UtensilsCrossed size={22} /></div>
                  <div className="stat-card__value">{stats?.total_almuerzos || 0}</div>
                  <div className="stat-card__label">Almuerzos</div>
                </div>
                <div className="stat-card stat-card--desayuno">
                  <div className="stat-card__icon"><Coffee size={22} /></div>
                  <div className="stat-card__value">{stats?.total_desayunos || 0}</div>
                  <div className="stat-card__label">Desayunos</div>
                </div>
                <div className="stat-card stat-card--benef">
                  <div className="stat-card__icon"><ShieldCheck size={22} /></div>
                  <div className="stat-card__value">{stats?.total_beneficiarios || 0}</div>
                  <div className="stat-card__label">Beneficiarios</div>
                </div>
                <div className="stat-card stat-card--nobenef">
                  <div className="stat-card__icon"><ShieldAlert size={22} /></div>
                  <div className="stat-card__value">{stats?.total_no_beneficiarios || 0}</div>
                  <div className="stat-card__label">No Beneficiarios</div>
                </div>
              </div>

              {/* Registros de Hoy con paginación */}
              <div className="recent-activity" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> Registros de Hoy
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>
                    Total: {registrosHoy.length}
                  </span>
                </div>
                {registrosHoy.length === 0 ? (
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                    Sin registros hoy.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {registrosHoy
                        .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                        .map(r => (
                          <div key={r.id_registro} className="recent-item">
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.88rem' }}>
                                {`${r.paterno}${r.materno ? ' ' + r.materno : ''}, ${r.nombres}`.toUpperCase()}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '2px' }}>
                                {r.rut} &bull; {r.nombre_curso || 'S/C'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span className={`meal-badge ${(r.tipo_alimentacion || '').toLowerCase() === 'almuerzo' ? 'lunch' : 'breakfast'}`}>
                                {(r.tipo_alimentacion || '').replace(/^./, c => c.toUpperCase())}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                                {formatTime(r.hora_entrega)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                    {Math.ceil(registrosHoy.length / PAGE_SIZE) > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                        <button
                          className="action-btn"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          style={{ fontSize: '0.8rem', padding: '4px 14px' }}
                        >
                          ← Anterior
                        </button>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                          Página {currentPage} de {Math.ceil(registrosHoy.length / PAGE_SIZE)}
                        </span>
                        <button
                          className="action-btn"
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(registrosHoy.length / PAGE_SIZE), p + 1))}
                          disabled={currentPage === Math.ceil(registrosHoy.length / PAGE_SIZE)}
                          style={{ fontSize: '0.8rem', padding: '4px 14px' }}
                        >
                          Siguiente →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.08)', margin: '1.5rem 0' }} />

        {/* ===== SECCIÓN 2: GENERADOR DE REPORTES ===== */}
        <div style={{ marginBottom: '2rem' }}>
          <button 
            className="report-toggle-btn"
            onClick={() => setShowReportPanel(!showReportPanel)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileSpreadsheet size={20} />
              <span>Generar Reportes</span>
            </div>
            <ChevronDown 
              size={18} 
              style={{ 
                transition: 'transform 0.3s ease',
                transform: showReportPanel ? 'rotate(180deg)' : 'rotate(0deg)'
              }} 
            />
          </button>

          {showReportPanel && (
            <div className="report-panel fade-in">
              
              {/* Período */}
              <div className="report-section">
                <label className="report-section-label">
                  <Calendar size={14} /> Período del Reporte
                </label>
                <div className="report-dates">
                  <div className="date-field">
                    <label>Desde</label>
                    <input 
                      type="date" 
                      value={reportDesde} 
                      onChange={(e) => setReportDesde(e.target.value)} 
                    />
                  </div>
                  <div className="date-field">
                    <label>Hasta</label>
                    <input 
                      type="date" 
                      value={reportHasta} 
                      onChange={(e) => setReportHasta(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              {/* Ámbito del Reporte */}
              <div className="report-section">
                <label className="report-section-label">Ámbito de Selección de Alumnos</label>
                <div className="report-scope-selector">
                  <button 
                    type="button"
                    className={`report-scope-btn ${reportScope === 'masivo' ? 'active' : ''}`}
                    onClick={() => setReportScope('masivo')}
                  >
                    🌍 Masivo
                  </button>
                  <button 
                    type="button"
                    className={`report-scope-btn ${reportScope === 'curso' ? 'active' : ''}`}
                    onClick={() => setReportScope('curso')}
                  >
                    🏫 Por Curso
                  </button>
                  <button 
                    type="button"
                    className={`report-scope-btn ${reportScope === 'nivel' ? 'active' : ''}`}
                    onClick={() => setReportScope('nivel')}
                  >
                    📈 Por Nivel
                  </button>
                  <button 
                    type="button"
                    className={`report-scope-btn ${reportScope === 'individual' ? 'active' : ''}`}
                    onClick={() => setReportScope('individual')}
                  >
                    👤 Individual
                  </button>
                  <button 
                    type="button"
                    className={`report-scope-btn ${reportScope === 'personalizado' ? 'active' : ''}`}
                    onClick={() => setReportScope('personalizado')}
                  >
                    ⚙️ Personalizado
                  </button>
                </div>

                {/* Controles Dinámicos */}
                {reportScope === 'curso' && (
                  <div className="report-scope-control fade-in" style={{ marginTop: '12px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Curso</label>
                    <select 
                      value={selectedCursoId} 
                      onChange={(e) => setSelectedCursoId(e.target.value)}
                      className="report-select-input"
                    >
                      <option value="">-- Selecciona un Curso --</option>
                      {courses.map(c => (
                        <option key={c.id_curso} value={c.id_curso}>{c.nombre_curso}</option>
                      ))}
                    </select>
                  </div>
                )}

                {reportScope === 'nivel' && (
                  <div className="report-scope-control fade-in" style={{ marginTop: '12px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Nivel de Enseñanza</label>
                    <select 
                      value={selectedNivelId} 
                      onChange={(e) => setSelectedNivelId(e.target.value)}
                      className="report-select-input"
                    >
                      <option value="">-- Selecciona un Nivel --</option>
                      {levels.map(l => (
                        <option key={l.id_nivel} value={l.id_nivel}>{l.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}

                {reportScope === 'individual' && (
                  <div className="report-scope-control fade-in" style={{ marginTop: '12px', position: 'relative' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Buscar Alumno</label>
                    {selectedAlumno ? (
                      <div className="selected-item-display">
                        <span>{selectedAlumno.name} ({selectedAlumno.rut}-{selectedAlumno.dv} &bull; {selectedAlumno.nombre_curso || 'Sin Curso'})</span>
                        <button 
                          type="button" 
                          onClick={() => { setSelectedAlumno(null); setStudentSearchTerm(''); }}
                          className="remove-btn"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <input 
                          type="text" 
                          placeholder="Escribe nombre, apellido o RUT del alumno..."
                          value={studentSearchTerm} 
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          className="report-text-input"
                        />
                        {isSearchingStudents && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>Buscando...</div>}
                        {studentSearchResults.length > 0 && (
                          <div className="report-search-results-dropdown">
                            {studentSearchResults.map(s => (
                              <div 
                                key={s.id_alumno} 
                                className="report-search-result-item"
                                onClick={() => {
                                  setSelectedAlumno(s);
                                  setStudentSearchTerm('');
                                  setStudentSearchResults([]);
                                }}
                              >
                                {s.name} ({s.rut}-{s.dv} &bull; {s.nombre_curso || 'Sin Curso'})
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {reportScope === 'personalizado' && (
                  <div className="report-scope-control fade-in" style={{ marginTop: '12px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Seleccionar Múltiples Alumnos ({selectedAlumnos.length} agregados)</label>
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="Buscar alumno para agregar al reporte..."
                        value={studentSearchTerm} 
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                        className="report-text-input"
                      />
                      {isSearchingStudents && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>Buscando...</div>}
                      {studentSearchResults.length > 0 && (
                        <div className="report-search-results-dropdown">
                          {studentSearchResults
                            .filter(s => !selectedAlumnos.some(a => a.id_alumno === s.id_alumno))
                            .map(s => (
                              <div 
                                key={s.id_alumno} 
                                className="report-search-result-item"
                                onClick={() => {
                                  setSelectedAlumnos([...selectedAlumnos, s]);
                                  setStudentSearchTerm('');
                                  setStudentSearchResults([]);
                                }}
                              >
                                {s.name} ({s.rut}-{s.dv} &bull; {s.nombre_curso || 'Sin Curso'})
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {selectedAlumnos.length > 0 && (
                      <div className="selected-chips-container">
                        {selectedAlumnos.map(a => (
                          <div key={a.id_alumno} className="student-chip">
                            <span>{a.name} ({a.nombre_curso || 'S/C'})</span>
                            <button 
                              type="button" 
                              onClick={() => setSelectedAlumnos(selectedAlumnos.filter(x => x.id_alumno !== a.id_alumno))}
                              className="chip-remove-btn"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tipo de Reporte */}
              <div className="report-section">
                <label className="report-section-label">Tipo de Reporte</label>
                <div className="report-types-grid">
                  {REPORT_TYPES.map(rt => (
                    <div 
                      key={rt.id}
                      className={`report-type-card ${reportType === rt.id ? 'active' : ''}`}
                      onClick={() => setReportType(rt.id)}
                    >
                      <div className="report-type-card__header">
                        {rt.icon}
                        <span>{rt.label}</span>
                      </div>
                      <p className="report-type-card__desc">{rt.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formato del Reporte */}
              <div className="report-section">
                <label className="report-section-label">Formato</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`report-format-btn ${reportFormat === 'detallado' ? 'active' : ''}`}
                    onClick={() => setReportFormat('detallado')}
                  >
                    📋 Detallado (Marcas D/A por día)
                  </button>
                  <button
                    className={`report-format-btn ${reportFormat === 'resumido' ? 'active' : ''}`}
                    onClick={() => setReportFormat('resumido')}
                  >
                    📊 Resumido (Totales)
                  </button>
                </div>
              </div>

              {/* Botón Generar */}
              <button 
                className="generate-report-btn"
                onClick={generateReport}
                disabled={generatingReport || !reportDesde || !reportHasta}
              >
                {generatingReport ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Generando...
                  </>
                ) : (
                  <>
                    <Download size={16} /> Descargar Reporte Excel
                  </>
                )}
              </button>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', textAlign: 'center', marginTop: '8px' }}>
                {reportFormat === 'detallado' 
                  ? 'Genera una hoja por mes con marcas D/A por cada día.'
                  : 'Genera una tabla resumen con total de desayunos y almuerzos por alumno.'
                }
              </p>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

export default AdminDashboard;
