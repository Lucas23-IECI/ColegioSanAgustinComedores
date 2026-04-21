import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config';

const normalizeHeaderKey = (value) => {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const sanitizeText = (value) => String(value ?? '').trim();

const isTruthyMark = (value) => {
  const normalized = sanitizeText(value).toLowerCase();
  if (!normalized) return false;
  return !['0', 'no', 'n', 'false', '-'].includes(normalized);
};

const formatDateInput = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const formatDisplayDate = (value) => {
  if (!value) return 'N/D';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/D';
  return parsed.toLocaleDateString('es-CL');
};

const getStudentLabel = (student) => {
  if (!student) return 'Seleccione un alumno';
  const parts = [student.rut ? `${student.rut}` : null, student.name, student.grade ? `(${student.grade})` : null].filter(Boolean);
  return parts.join(' - ');
};

const formatRutWithDv = (rut, dv) => {
  const run = sanitizeText(rut);
  const verifier = sanitizeText(dv).toUpperCase();
  if (!run) return 'Sin RUT';
  return verifier ? `${run}-${verifier}` : run;
};

// Parsear Excel formato PAE (sin columnas de desayuno/almuerzo)
const parsePAEExcel = async (file) => {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas válidas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows.length) {
    throw new Error('No se detectaron datos en la hoja.');
  }

  // Normalizar RUT: "24447036-K" → { run: "24447036", dv: "K" }
  const normalizeRUT = (rutString) => {
    const str = sanitizeText(rutString);
    if (!str) return { run: '', dv: '' };

    const parts = str.split('-');
    if (parts.length === 2) {
      return { run: parts[0].replace(/[^\d]/g, ''), dv: parts[1].trim().toUpperCase() };
    }

    // Sin guion: preservar RUN numerico puro y separar DV solo si aplica.
    const trimmed = str.replace(/[^0-9a-kA-K]/g, '').toUpperCase();
    if (!trimmed) return { run: '', dv: '' };
    if (/^\d+$/.test(trimmed)) {
      if (trimmed.length <= 8) return { run: trimmed, dv: '' };
      return { run: trimmed.slice(0, -1), dv: trimmed.slice(-1) };
    }
    if (trimmed.length < 2) return { run: trimmed.replace(/[^\d]/g, ''), dv: '' };

    return {
      run: trimmed.slice(0, -1).replace(/[^\d]/g, ''),
      dv: trimmed.slice(-1)
    };
  };

  const hasAny = (value, tokens) => tokens.some((token) => value.includes(token));

  // Detectar fila de encabezado real (soporta titulos en la fila 1)
  const headerIndex = rawRows.findIndex((row) => {
    const keys = (row || []).map((cell) => normalizeHeaderKey(cell));
    const hasRun = keys.some((k) => hasAny(k, ['run', 'rut', 'nderun', 'nrun']));
    const hasNombre = keys.some((k) => hasAny(k, ['nombre', 'nombres']));
    const hasApellido = keys.some((k) => hasAny(k, ['apellido', 'apellidos']));
    return hasRun && (hasNombre || hasApellido);
  });

  if (headerIndex === -1) {
    throw new Error('No se encontró la fila de encabezados del Excel PAE.');
  }

  const headerRow = rawRows[headerIndex] || [];
  const dataRows = rawRows.slice(headerIndex + 1);

  const getValueByTokens = (row, tokens) => {
    for (let col = 0; col < headerRow.length; col++) {
      const key = normalizeHeaderKey(headerRow[col]);
      if (!key) continue;
      if (!tokens.some((token) => key.includes(token))) continue;
      const value = sanitizeText(row[col]);
      if (value) return value;
    }
    return '';
  };

  const importRows = [];
  const previewRows = [];

  dataRows.forEach((row, dataIndex) => {
    if (!(row || []).some((cell) => sanitizeText(cell) !== '')) return;

    const runRaw = getValueByTokens(row, ['run', 'rut', 'nderun', 'nrun']);
    const dvRaw = getValueByTokens(row, ['dv', 'digitoverificador', 'digito']);
    const apellidos = getValueByTokens(row, ['apellido', 'apellidos']);
    const nombre = getValueByTokens(row, ['nombre', 'nombres']);
    const curso = getValueByTokens(row, ['curso']);
    const porcentaje = getValueByTokens(row, ['rsh', 'porcent']);
    const email = getValueByTokens(row, ['email', 'correo', 'mail']);

    const separated = normalizeRUT(runRaw);
    const run = separated.run;
    const dv = sanitizeText(dvRaw || separated.dv).toUpperCase();

    // Solo requerir RUN válido - los demás campos son opcionales
    if (!run) return;

    const sourceRow = headerIndex + 2 + dataIndex;
    const parsedRow = {
      sourceRow,
      run,
      dv: dv || null,
      apellidos,
      nombre,
      curso,
      porcentaje,
      email
    };

    importRows.push(parsedRow);
    previewRows.push({
      sourceRow,
      run: `${run}-${dv || '?'}`,
      apellidos: apellidos || '—',
      nombre: nombre || '—',
      curso: curso || '—',
      porcentaje: porcentaje || 'S/I'
    });
  });

  if (importRows.length === 0) {
    throw new Error('No se encontraron filas válidas con RUT.');
  }

  return { rows: importRows, previewRows, sheetName: firstSheetName };
};

const parseBeneficiaryExcel = async (file, month) => {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas válidas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) {
    throw new Error('No se detectaron datos en la hoja.');
  }

  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeaderKey(cell) === 'apellidos'));
  if (headerIndex === -1) {
    throw new Error('No se encontró la fila de encabezados del Excel.');
  }

  const headerRow = rows[headerIndex] || [];
  const typeRow = rows[headerIndex + 1] || [];
  const dataStart = headerIndex + 2;

  const emailIndex = headerRow.findIndex((cell) => ['correo', 'email', 'mail'].includes(normalizeHeaderKey(cell)));
  const effectiveLastIndex = emailIndex > 0 ? emailIndex : headerRow.length - 1;
  const monthPrefix = `${month}-`;

  const importRows = [];
  const previewRows = [];

  for (let rowIndex = dataStart; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] || [];
    if (!row.some((value) => sanitizeText(value) !== '')) continue;

    const apellidos = sanitizeText(row[1]);
    const nombre = sanitizeText(row[2]);
    const curso = sanitizeText(row[3]);
    const email = emailIndex >= 0 ? sanitizeText(row[emailIndex]) : '';

    const mealMarks = [];
    let currentDay = null;

    for (let col = 4; col <= effectiveLastIndex; col++) {
      const dayCell = sanitizeText(headerRow[col]);
      const typeCell = sanitizeText(typeRow[col]).toUpperCase();

      if (dayCell && /^\d+$/.test(dayCell)) {
        currentDay = parseInt(dayCell, 10);
      }

      if (!currentDay || !['D', 'A'].includes(typeCell)) continue;

      const cellValue = row[col];
      if (!isTruthyMark(cellValue)) continue;

      const date = `${monthPrefix}${String(currentDay).padStart(2, '0')}`;
      mealMarks.push({
        day: currentDay,
        date,
        tipo_alimentacion: typeCell === 'D' ? 'desayuno' : 'almuerzo'
      });
    }

    const sourceRow = rowIndex + 1;
    const parsedRow = {
      sourceRow,
      apellidos,
      nombre,
      curso,
      email,
      activo: true,
      fecha_inicio: `${month}-01`,
      motivo_ingreso: '',
      meals: mealMarks
    };

    importRows.push(parsedRow);
    previewRows.push({
      sourceRow,
      apellidos,
      nombre,
      curso,
      email,
      meals: mealMarks.length,
      firstMeal: mealMarks[0]?.date || ''
    });
  }

  return { rows: importRows, previewRows, sheetName: firstSheetName };
};

const emptyForm = {
  id_alumno: '',
  activo: true,
  fecha_inicio: '',
  motivo_ingreso: ''
};

const BeneficiariosAdmin = () => {
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('listado');
  const [selectedBeneficiario, setSelectedBeneficiario] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [excelMonth, setExcelMonth] = useState('');
  const [excelFileName, setExcelFileName] = useState('');
  const [excelRows, setExcelRows] = useState([]);
  const [excelPreview, setExcelPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  // Estados para importación PAE
  const [paeFileName, setPaeFileName] = useState('');
  const [paeRows, setPaeRows] = useState([]);
  const [paePreview, setPaePreview] = useState([]);
  const [paeImporting, setPaeImporting] = useState(false);
  const [paeImportResult, setPaeImportResult] = useState(null);
  const [paeImportError, setPaeImportError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setExcelMonth(currentMonth);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [benefRes, studentsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/beneficiarios`, { withCredentials: true }),
        axios.get(`${API_URL}/students`, { withCredentials: true })
      ]);
      setBeneficiarios(benefRes.data || []);
      setStudents(studentsRes.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'No fue posible cargar los beneficiarios.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedBeneficiario(null);
    setForm(emptyForm);
  };

  const editBeneficiario = (item) => {
    setSelectedBeneficiario(item);
    setForm({
      id_alumno: String(item.id_alumno || ''),
      activo: Boolean(item.activo),
      fecha_inicio: formatDateInput(item.fecha_inicio),
      motivo_ingreso: item.motivo_ingreso || ''
    });
    setMessage('');
    setError('');
    setActiveTab('edicion');
  };

  const saveBeneficiario = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const idAlumno = parseInt(form.id_alumno, 10);
    if (!Number.isInteger(idAlumno) || idAlumno <= 0) {
      setSaving(false);
      setError('Debes seleccionar un alumno válido.');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/admin/beneficiarios`,
        {
          id_alumno: idAlumno,
          activo: Boolean(form.activo),
          fecha_inicio: form.fecha_inicio || null,
          motivo_ingreso: form.motivo_ingreso || null
        },
        { withCredentials: true }
      );

      setMessage('Beneficiario guardado correctamente.');
      resetForm();
      await fetchData();
      setActiveTab('listado');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'No se pudo guardar el beneficiario.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    setImportError('');
    setImportResult(null);
    setExcelRows([]);
    setExcelPreview([]);
    setExcelFileName('');

    if (!file) return;
    if (!excelMonth) {
      setImportError('Primero selecciona el mes correspondiente.');
      return;
    }

    try {
      const parsed = await parseBeneficiaryExcel(file, excelMonth);
      setExcelRows(parsed.rows);
      setExcelPreview(parsed.previewRows);
      setExcelFileName(file.name);
      if (parsed.rows.length === 0) {
        setImportError('El archivo no contiene filas válidas para importar.');
      }
    } catch (err) {
      console.error(err);
      setImportError(err.message || 'No fue posible leer el archivo Excel.');
    }
  };

  const importExcel = async () => {
    if (!excelRows.length || importing) return;
    if (!excelMonth) {
      setImportError('Debes indicar el mes de referencia antes de importar.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const res = await axios.post(
        `${API_URL}/admin/beneficiarios/import`,
        {
          month: excelMonth,
          rows: excelRows,
          defaultActivo: true
        },
        { withCredentials: true }
      );

      const errors = Array.isArray(res.data?.errors) ? res.data.errors : [];
      const warnings = Array.isArray(res.data?.warnings) ? res.data.warnings : [];
      console.log('[beneficiarios/import] Respuesta importacion', res.data);
      if (warnings.length > 0) {
        console.warn('[beneficiarios/import] Warnings', warnings);
      }
      if (errors.length > 0) {
        console.error('[beneficiarios/import] Errores', errors);
      }

      setImportResult(res.data);
      setMessage('Importación completada correctamente.');
      await fetchData();
    } catch (err) {
      console.error(err);
      const backendMessage = err.response?.data?.message;
      const statusCode = err.response?.status;
      const fallback = err.message || 'No se pudo importar el Excel.';
      setImportError(backendMessage || (statusCode ? `Error ${statusCode}: ${fallback}` : fallback));
    } finally {
      setImporting(false);
    }
  };

  const handlePAEUpload = async (event) => {
    const file = event.target.files?.[0];
    setPaeImportError('');
    setPaeImportResult(null);
    setPaeRows([]);
    setPaePreview([]);
    setPaeFileName('');

    if (!file) return;

    try {
      const parsed = await parsePAEExcel(file);
      setPaeRows(parsed.rows);
      setPaePreview(parsed.previewRows);
      setPaeFileName(file.name);
      if (parsed.rows.length === 0) {
        setPaeImportError('El archivo no contiene filas válidas para importar.');
      }
    } catch (err) {
      console.error(err);
      setPaeImportError(err.message || 'No fue posible leer el archivo Excel.');
    }
  };

  const importPAE = async () => {
    if (!paeRows.length || paeImporting) return;

    setPaeImporting(true);
    setPaeImportError('');
    setPaeImportResult(null);

    // Usar mes actual automáticamente
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      const res = await axios.post(
        `${API_URL}/admin/beneficiarios/import-pae`,
        {
          month: currentMonth,
          rows: paeRows
        },
        { withCredentials: true }
      );

      const errors = Array.isArray(res.data?.errors) ? res.data.errors : [];
      const warnings = Array.isArray(res.data?.warnings) ? res.data.warnings : [];
      const importedTotal =
        (res.data?.beneficiarios_insertados || 0) +
        (res.data?.beneficiarios_actualizados || 0) +
        (res.data?.beneficiarios_sin_cambios || 0);
      console.log('[beneficiarios/import-pae] Respuesta importacion', res.data);
      if (warnings.length > 0) {
        console.warn('[beneficiarios/import-pae] Warnings', warnings);
      }
      if (errors.length > 0) {
        console.error('[beneficiarios/import-pae] Errores', errors);
      }

      setPaeImportResult(res.data);
      if (errors.length === 0 && warnings.length === 0 && importedTotal > 0) {
        setMessage('Importación PAE completada correctamente (sin asistencias retroactivas).');
      } else {
        setMessage('');
      }
      await fetchData();
    } catch (err) {
      console.error(err);
      const backendMessage = err.response?.data?.message;
      const statusCode = err.response?.status;
      const fallback = err.message || 'No se pudo importar el Excel PAE.';
      setPaeImportError(backendMessage || (statusCode ? `Error ${statusCode}: ${fallback}` : fallback));
    } finally {
      setPaeImporting(false);
    }
  };

  const filteredBeneficiarios = beneficiarios.filter((item) => {
    const rutCompleto = formatRutWithDv(item.rut, item.dv);
    const hayTermino = `${rutCompleto} ${item.rut || ''} ${item.dv || ''} ${item.nombres || ''} ${item.paterno || ''} ${item.materno || ''} ${item.nombre_curso || ''}`.toLowerCase();
    return hayTermino.includes(searchTerm.toLowerCase());
  });

  const paeImportedTotal =
    (paeImportResult?.beneficiarios_insertados || 0) +
    (paeImportResult?.beneficiarios_actualizados || 0) +
    (paeImportResult?.beneficiarios_sin_cambios || 0);
  const paeHasIssues =
    Boolean(paeImportResult) &&
    ((paeImportResult?.errors?.length || 0) > 0 ||
      (paeImportResult?.warnings?.length || 0) > 0 ||
      paeImportedTotal === 0);
  const paeResultPanelStyle = paeHasIssues
    ? {
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        fontSize: '0.85rem'
      }
    : {
        background: 'rgba(5, 150, 105, 0.05)',
        border: '1px solid rgba(5, 150, 105, 0.2)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        fontSize: '0.85rem'
      };
  const paeResultTitleColor = paeHasIssues ? '#d97706' : '#059669';
  const paeResultDetailColor = paeHasIssues ? '#b45309' : 'var(--text-light)';

  return (
    <div className="students-page">
      <div className="students-card" style={{ maxWidth: '1200px' }}>
        <header className="students-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div className="students-header-left">
            <button className="students-back-btn" onClick={() => navigate('/admin')}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="students-title">Beneficiarios de Alimentación</h1>
              <p style={{ color: 'var(--text-light)', marginTop: '4px', fontSize: '0.88rem' }}>
                Ver, editar, agregar y cargar Excel con marcas D/A por mes.
              </p>
            </div>
          </div>

          <button className="action-btn" onClick={fetchData} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <RefreshCw size={16} /> Recargar
          </button>
        </header>

        <div className="students-tabs">
          <button className={`students-tab ${activeTab === 'listado' ? 'active' : ''}`} onClick={() => setActiveTab('listado')}>
            <ShieldCheck size={16} /> Listado y edición
          </button>
          <button className={`students-tab ${activeTab === 'edicion' ? 'active' : ''}`} onClick={() => setActiveTab('edicion')}>
            <Plus size={16} /> Agregar / editar
          </button>
          <button className={`students-tab ${activeTab === 'carga' ? 'active' : ''}`} onClick={() => setActiveTab('carga')}>
            <FileSpreadsheet size={16} /> Carga asistencia
          </button>
          <button className={`students-tab ${activeTab === 'pae' ? 'active' : ''}`} onClick={() => setActiveTab('pae')}>
            <FileSpreadsheet size={16} /> Carga PAE
          </button>
        </div>

        {error && <div className="alert error" style={{ marginBottom: '16px' }}>{error}</div>}
        {message && <div className="alert success" style={{ marginBottom: '16px' }}>{message}</div>}

        {activeTab === 'listado' && (
          <div className="fade-in">
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div className="students-search" style={{ flex: '1', minWidth: '280px' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar por RUT, nombre o curso..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                className="action-btn"
                onClick={() => {
                  resetForm();
                  setActiveTab('edicion');
                }}
                style={{ background: 'rgba(5, 150, 105, 0.08)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.18)' }}
              >
                <Plus size={16} /> Nuevo beneficiario
              </button>
            </div>

            {loading ? (
              <div className="loader">Cargando beneficiarios...</div>
            ) : (
              <div className="students-table-wrap">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Curso</th>
                      <th>Estado</th>
                      <th>Desde</th>
                      <th>Motivo</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBeneficiarios.map((item) => (
                      <tr key={item.id_beneficiario}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                            {item.nombres} {item.paterno} {item.materno || ''}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                            {formatRutWithDv(item.rut, item.dv)}
                          </div>
                        </td>
                        <td>{item.nombre_curso || 'S/C'}</td>
                        <td>
                          <span className={`students-badge ${item.activo ? 'badge-active' : 'badge-inactive'}`}>
                            {item.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.84rem' }}>
                          {formatDisplayDate(item.fecha_inicio)}
                        </td>
                        <td style={{ maxWidth: '240px' }}>{item.motivo_ingreso || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="students-ficha-btn" onClick={() => editBeneficiario(item)}>
                            <Edit3 size={14} /> Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredBeneficiarios.length === 0 && (
                  <p style={{ padding: '16px', color: 'var(--text-light)' }}>No hay beneficiarios coincidentes.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'edicion' && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <form onSubmit={saveBeneficiario} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>{selectedBeneficiario ? 'Editar beneficiario' : 'Agregar beneficiario'}</h3>
                {selectedBeneficiario && (
                  <button type="button" className="action-btn cancel" onClick={resetForm}>
                    <X size={16} /> Limpiar
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-light)', fontWeight: 600 }}>Alumno</span>
                  <select
                    value={form.id_alumno}
                    onChange={(e) => setForm((prev) => ({ ...prev, id_alumno: e.target.value }))}
                    style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'inherit' }}
                  >
                    <option value="">Selecciona un alumno</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {getStudentLabel(student)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-light)', fontWeight: 600 }}>Fecha inicio</span>
                  <input
                    type="date"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha_inicio: e.target.value }))}
                    style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'inherit' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-light)', fontWeight: 600 }}>Motivo ingreso</span>
                  <input
                    type="text"
                    value={form.motivo_ingreso}
                    onChange={(e) => setForm((prev) => ({ ...prev, motivo_ingreso: e.target.value }))}
                    placeholder="JUNAEB, vulnerabilidad, apoyo temporal, etc."
                    style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'inherit' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>Beneficiario activo</span>
                </label>

                <button
                  type="submit"
                  className="action-btn"
                  disabled={saving}
                  style={{ justifyContent: 'center', background: 'linear-gradient(135deg, #059669, #10B981)', color: 'white', padding: '12px 16px' }}
                >
                  {saving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />} {saving ? 'Guardando...' : 'Guardar beneficiario'}
                </button>
              </div>
            </form>

            <div style={{ background: 'rgba(79, 70, 229, 0.04)', border: '1px solid rgba(79, 70, 229, 0.12)', borderRadius: '16px', padding: '18px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-dark)' }}>Notas</h3>
              <p style={{ color: 'var(--text-light)', lineHeight: 1.6, marginBottom: '12px' }}>
                El beneficiario se guarda por alumno. Si ya existe, el sistema actualiza el registro vigente en lugar de duplicarlo.
              </p>
              <p style={{ color: 'var(--text-light)', lineHeight: 1.6, marginBottom: 0 }}>
                La importación Excel usa la misma lógica y además genera las colaciones en <strong>lunch_registrations</strong> cuando encuentra marcas D/A en el mes seleccionado.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'carga' && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '18px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} /> Carga de asistencias (con colaciones retroactivas)
              </h3>
              <p style={{ color: 'var(--text-light)', marginBottom: '16px', lineHeight: 1.5 }}>
                Elige el mes e importa un Excel con desayuno/almuerzo por día. Se crea/actualiza beneficiarios <strong>Y</strong> se generan registros retroactivos de asistencia a colación (lunch_registrations).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-light)', fontWeight: 600 }}>Mes a importar</span>
                  <input
                    type="month"
                    value={excelMonth}
                    onChange={(e) => setExcelMonth(e.target.value)}
                    style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', fontFamily: 'inherit' }}
                  />
                </label>

                <label className="action-btn" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: '#EEF2FF', color: 'var(--primary)', border: '1px solid #C7D2FE', cursor: 'pointer', padding: '12px 14px' }}>
                  <FileSpreadsheet size={16} /> Seleccionar Excel
                  <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display: 'none' }} />
                </label>

                <button
                  type="button"
                  className="action-btn"
                  onClick={importExcel}
                  disabled={!excelRows.length || importing || !excelMonth}
                  style={{ background: excelRows.length && excelMonth ? '#059669' : '#CBD5E1', color: 'white', padding: '12px 14px' }}
                >
                  {importing ? <RefreshCw size={16} className="spin" /> : <Upload size={16} />} {importing ? 'Importando...' : 'Importar beneficiarios'}
                </button>
              </div>

              {excelFileName && (
                <p style={{ marginTop: '10px', color: 'var(--text-light)', fontSize: '0.88rem' }}>
                  Archivo cargado: <strong style={{ color: 'var(--text-dark)' }}>{excelFileName}</strong> ({excelRows.length} filas procesadas)
                </p>
              )}

              {importError && <div className="alert error" style={{ marginTop: '12px' }}>{importError}</div>}
              {importResult && (
                <div className="alert success" style={{ marginTop: '12px', display: 'block' }}>
                  <div><strong>Importación completada</strong></div>
                  <div style={{ marginTop: '6px' }}>
                    Beneficiarios insertados: {importResult.beneficiarios_insertados || 0} | Actualizados: {importResult.beneficiarios_actualizados || 0} | Sin cambios: {importResult.beneficiarios_sin_cambios || 0}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    Colaciones insertadas: {importResult.colaciones_insertadas || 0} | Omitidas: {importResult.colaciones_omitidas || 0} | Errores: {importResult.errors?.length || 0}
                  </div>
                </div>
              )}
            </div>

            {excelPreview.length > 0 && (
              <div className="students-table-wrap">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Apellidos</th>
                      <th>Nombre</th>
                      <th>Curso</th>
                      <th>Email</th>
                      <th>Colaciones</th>
                      <th>Primer registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.slice(0, 20).map((row) => (
                      <tr key={`${row.sourceRow}-${row.nombre}`}>
                        <td>{row.sourceRow}</td>
                        <td>{row.apellidos || '—'}</td>
                        <td>{row.nombre || '—'}</td>
                        <td>{row.curso || '—'}</td>
                        <td>{row.email || '—'}</td>
                        <td>{row.meals}</td>
                        <td>{row.firstMeal || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {excelPreview.length > 20 && (
                  <p style={{ padding: '12px 16px', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                    Mostrando 20 de {excelPreview.length} filas.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pae' && (
          <div className="fade-in">
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '12px', fontStyle: 'italic' }}>
                ℹ️ Solo importa alumnos que ya existen en la base de datos. Los RUT no encontrados se omiten con advertencia.
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ flex: '1', minWidth: '200px', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.1)', border: '1px dashed rgba(59, 130, 246, 0.3)', borderRadius: '6px', padding: '12px', textAlign: 'center', transition: 'all 0.2s' }}>
                  <Upload size={18} style={{ marginBottom: '4px' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Cargar Excel PAE (RUT, Apellidos, Nombre, Curso, %RSH)</div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handlePAEUpload}
                    style={{ display: 'none' }}
                  />
                </label>
                <button
                  className="action-btn"
                  onClick={importPAE}
                  disabled={paeRows.length === 0 || paeImporting}
                  style={{ background: paeRows.length === 0 || paeImporting ? 'var(--gray-light)' : 'rgba(5, 150, 105, 0.1)', color: paeRows.length === 0 || paeImporting ? 'var(--gray-dark)' : '#059669' }}
                >
                  {paeImporting ? 'Importando...' : 'Importar PAE'}
                </button>
              </div>
              {paeFileName && (
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                  Archivo: {paeFileName} ({paeRows.length} filas)
                </div>
              )}
            </div>

            {paeImportError && <div className="alert error" style={{ marginBottom: '16px' }}>{paeImportError}</div>}

            {paeImportResult && (
              <div style={paeResultPanelStyle}>
                <div style={{ fontWeight: 600, color: paeResultTitleColor, marginBottom: '6px' }}>Resultado de importación PAE:</div>
                <div>
                  Total: {paeImportResult.total} | Insertados: {paeImportResult.beneficiarios_insertados} | Actualizados: {paeImportResult.beneficiarios_actualizados} | Sin cambios: {paeImportResult.beneficiarios_sin_cambios} | Errores: {paeImportResult.errors?.length || 0}
                </div>
                {paeImportResult.warnings && paeImportResult.warnings.length > 0 && (
                  <div style={{ marginTop: '8px', color: paeResultDetailColor }}>
                    Advertencias: {paeImportResult.warnings.length}
                  </div>
                )}
              </div>
            )}

            {paePreview.length > 0 && (
              <div className="students-table-wrap">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>RUT</th>
                      <th>Apellidos</th>
                      <th>Nombre</th>
                      <th>Curso</th>
                      <th>Beneficio %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paePreview.slice(0, 25).map((row) => (
                      <tr key={`${row.sourceRow}-${row.run}`}>
                        <td>{row.sourceRow}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{row.run}</td>
                        <td>{row.apellidos || '—'}</td>
                        <td>{row.nombre || '—'}</td>
                        <td>{row.curso || '—'}</td>
                        <td>{row.porcentaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paePreview.length > 25 && (
                  <p style={{ padding: '12px 16px', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                    Mostrando 25 de {paePreview.length} filas.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BeneficiariosAdmin;
