import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, X, HeartPulse, DollarSign, Users, GraduationCap, Database, Upload, FileSpreadsheet, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './index.css';

import { API_URL } from './config';

const normalizeHeaderKey = (value) => {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const getCell = (row, aliases) => {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeaderKey(alias)));
  for (const [key, value] of Object.entries(row || {})) {
    if (!aliasSet.has(normalizeHeaderKey(key))) continue;
    const cleaned = String(value ?? '').trim();
    if (cleaned !== '') return cleaned;
  }
  return '';
};

function Students() {
  const [activeSection, setActiveSection] = useState('listado');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);

  const [excelRows, setExcelRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/students`);
      setStudents(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (id) => {
    setSelectedStudentId(id);
    setLoadingDetails(true);
    setStudentDetails(null);
    try {
      const res = await axios.get(`${API_URL}/students/${id}/details`);
      setStudentDetails(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelectedStudentId(null);
    setStudentDetails(null);
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    setUploadError('');
    setSyncResult(null);

    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setUploadError('El archivo no contiene hojas válidas.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const nonEmptyRows = parsedRows.filter((row) =>
        Object.values(row).some((value) => String(value).trim() !== '')
      );

      if (!nonEmptyRows.length) {
        setUploadError('No se detectaron filas con datos en la hoja.');
        setExcelRows([]);
        setPreviewRows([]);
        setExcelFileName('');
        return;
      }

      const mappedPreview = nonEmptyRows.map((row, index) => {
        const rut = getCell(row, ['rut', 'run', 'rut alumno', 'run alumno']);
        const nombres = getCell(row, ['nombres', 'nombre']);
        const paterno = getCell(row, ['paterno']);
        const materno = getCell(row, ['materno']);
        const nombreCompleto = getCell(row, ['nombre completo', 'alumno', 'name']);
        const nombre = nombreCompleto || [nombres, paterno, materno].filter(Boolean).join(' ');

        const curso = getCell(row, ['curso', 'grade', 'nombre curso', 'curso actual', 'nivel', 'enseñanza', 'ensenanza']);
        const email = getCell(row, ['email', 'correo', 'correo electronico', 'mail']);
        return { index: index + 2, rut, nombre, curso, email };
      });

      setExcelRows(nonEmptyRows);
      setPreviewRows(mappedPreview);
      setExcelFileName(file.name);
    } catch (err) {
      console.error(err);
      setUploadError('No fue posible leer el archivo Excel.');
    }
  };

  const syncExcelWithDatabase = async () => {
    if (!excelRows.length || syncing) return;

    setSyncing(true);
    setUploadError('');
    setSyncResult(null);

    try {
      const res = await axios.post(`${API_URL}/students/bulk-sync`, { students: excelRows });
      setSyncResult(res.data);
      fetchStudents();
      setSelectedCourse(null);
      setActiveSection('listado');
    } catch (err) {
      console.error(err);
      setUploadError(err.response?.data?.message || 'Falló la sincronización de estudiantes.');
    } finally {
      setSyncing(false);
    }
  };

  const courseGroups = students.reduce((acc, s) => {
    const curso = s.grade || 'Sin Curso Asignado';
    if (!acc[curso]) acc[curso] = [];
    acc[curso].push(s);
    return acc;
  }, {});

  const currentStudents = selectedCourse === 'Toda La Matrícula' 
     ? students 
     : (courseGroups[selectedCourse] || []);

  const filtered = currentStudents.filter(s => {
    return s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           s.rut.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatNullable = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') return 'N/D';
    return String(value);
  };

  return (
    <div className="students-page">
      <div className="students-card">
        
        <header className="students-header">
           <div className="students-header-left">
              <button 
                onClick={() => {
                   if (selectedCourse) {
                     setSelectedCourse(null);
                     return;
                   }
                   if (activeSection === 'carga') {
                     setActiveSection('listado');
                     return;
                   }
                   navigate('/admin');
                }} 
                className="students-back-btn"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="students-title">
                 {activeSection === 'listado'
                   ? (selectedCourse ? `Alumnos: ${selectedCourse}` : 'Listado de Cursos')
                   : 'Carga de BD de Estudiantes'}
              </h1>
           </div>
        </header>

        <div className="students-tabs">
          <button
            className={`students-tab ${activeSection === 'listado' ? 'active' : ''}`}
            onClick={() => {
              setActiveSection('listado');
              setUploadError('');
            }}
          >
            <Users size={16} /> Listado de Estudiantes
          </button>
          <button
            className={`students-tab ${activeSection === 'carga' ? 'active' : ''}`}
            onClick={() => {
              setActiveSection('carga');
              setSelectedCourse(null);
            }}
          >
            <Database size={16} /> Carga de BD
          </button>
        </div>

        {activeSection === 'listado' && loading ? (
          <div className="loader">Cargando padrón...</div>
        ) : activeSection === 'listado' && !selectedCourse ? (
          <div className="fade-in">
             <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>
                Selecciona la nómina de un curso para inspeccionar su universo de alumnos.
             </p>
             <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px'}}>
                <div 
                  className="registration-card"
                  style={{padding: '20px', cursor: 'pointer', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)', background: 'rgba(59, 130, 246, 0.05)'}}
                  onClick={() => setSelectedCourse('Toda La Matrícula')}
                >
                  <Users size={32} color="#3b82f6" style={{marginBottom: '10px'}}/>
                  <h3 style={{color: 'var(--text-dark)', margin: '0 0 5px 0'}}>Todos los Alumnos</h3>
                  <p style={{color: 'var(--text-light)', margin: 0}}>Padrón Global ({students.length})</p>
                </div>

                {Object.keys(courseGroups).sort().map(curso => (
                   <div 
                     key={curso} 
                     className="registration-card"
                     style={{padding: '20px', cursor: 'pointer', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)', background: 'white'}}
                     onClick={() => setSelectedCourse(curso)}
                   >
                     <GraduationCap size={32} color="var(--primary)" style={{marginBottom: '10px'}}/>
                     <h3 style={{color: 'var(--text-dark)', margin: '0 0 5px 0'}}>{curso}</h3>
                     <p style={{color: 'var(--text-light)', margin: 0}}>{courseGroups[curso].length} Alumnos</p>
                   </div>
                ))}
             </div>
          </div>
        ) : activeSection === 'listado' ? (
          <div className="fade-in">
             <div style={{display: 'flex', gap: '15px', marginBottom: '20px'}}>
               <div className="students-search" style={{flex: '1', minWidth: '250px'}}>
                 <Search size={16} />
                 <input
                   type="text"
                   placeholder={`Buscar alumno en ${selectedCourse}...`}
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
               </div>
             </div>

             <div className="students-table-wrap">
               <table className="students-table">
                 <thead>
                   <tr>
                     <th>RUT</th>
                     <th>Nombre Completo</th>
                     {selectedCourse === 'Toda La Matrícula' && <th>Curso</th>}
                     <th style={{textAlign: 'center'}}>Estado</th>
                     <th style={{textAlign: 'center'}}>JUNAEB</th>
                     <th style={{textAlign: 'right'}}>Acción</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filtered.map(s => (
                     <tr key={s.id}>
                       <td className="students-cell-mono">{s.rut}</td>
                       <td className="students-cell-name">{s.name}</td>
                       {selectedCourse === 'Toda La Matrícula' && <td>{s.grade || 'Sin Curso'}</td>}
                       <td style={{textAlign: 'center'}}>
                          <span className={`students-badge ${s.activo ? 'badge-active' : 'badge-inactive'}`}>
                            {s.activo ? 'Activa' : 'Retirado'}
                          </span>
                       </td>
                       <td style={{textAlign: 'center'}}>
                          {s.es_beneficiario ? 
                            <span className="students-badge badge-junaeb"><ShieldCheck size={12}/> Beneficiario</span> : 
                            <span style={{color: 'var(--text-light)', fontSize:'0.82rem'}}>—</span>}
                       </td>
                       <td style={{textAlign: 'right'}}>
                          <button onClick={() => openDetails(s.id)} className="students-ficha-btn">
                            Ver Ficha
                          </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               {filtered.length === 0 && <p style={{textAlign: 'center', marginTop: '20px', color: 'var(--text-light)'}}>No hay estudiantes coincidentes en esta nómina.</p>}
             </div>
          </div>
        ) : (
          <div className="fade-in">
            <div style={{background: 'white', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '14px', padding: '18px', marginBottom: '15px'}}>
              <h3 style={{margin: 0, marginBottom: '8px', color: 'var(--text-dark)', display: 'flex', gap: '8px', alignItems: 'center'}}>
                <FileSpreadsheet size={18} /> Subir archivo Excel
              </h3>
              <p style={{color: 'var(--text-light)', marginBottom: '12px', fontSize: '0.9rem'}}>
                Columnas recomendadas: RUT, Nombre o Nombres/Paterno, Curso, Email y Activo. El sistema comparará por RUT y decidirá si actualiza, crea o deja sin cambios.
              </p>

              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'}}>
                <label className="action-btn" style={{background: '#EEF2FF', color: 'var(--primary)', cursor: 'pointer', border: '1px solid #C7D2FE', padding: '10px 14px'}}>
                  <Upload size={16} /> Seleccionar Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    style={{display: 'none'}}
                  />
                </label>

                <button
                  className="action-btn"
                  onClick={syncExcelWithDatabase}
                  disabled={!excelRows.length || syncing}
                  style={{
                    background: excelRows.length ? '#059669' : '#CBD5E1',
                    color: 'white',
                    padding: '10px 14px',
                    cursor: excelRows.length && !syncing ? 'pointer' : 'not-allowed'
                  }}
                >
                  {syncing ? <RefreshCw size={16} className="spin" /> : <Database size={16} />} {syncing ? 'Sincronizando...' : 'Sincronizar con BD'}
                </button>
              </div>

              {excelFileName && (
                <p style={{marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-light)'}}>
                  Archivo cargado: <strong style={{color: 'var(--text-dark)'}}>{excelFileName}</strong> ({excelRows.length} filas)
                </p>
              )}

              {uploadError && (
                <div className="alert error" style={{marginTop: '12px'}}>{uploadError}</div>
              )}

              {syncResult && (
                <div className="alert success" style={{marginTop: '12px', display: 'block'}}>
                  <div><strong>Sincronización completada</strong></div>
                  <div style={{marginTop: '6px'}}>Insertados: {syncResult.inserted} | Actualizados: {syncResult.updated} | Sin cambios: {syncResult.unchanged}</div>
                  <div style={{marginTop: '4px'}}>Errores: {syncResult.errors?.length || 0}</div>
                </div>
              )}

              {syncResult?.errors?.length > 0 && (
                <div style={{marginTop: '12px', maxHeight: '160px', overflowY: 'auto', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', background: '#FEF2F2'}}>
                  {syncResult.errors.map((errorItem, idx) => (
                    <p key={`${errorItem.row}-${idx}`} style={{margin: '0 0 6px 0', color: '#991B1B', fontSize: '0.85rem'}}>
                      Fila {errorItem.row}: {errorItem.message}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {previewRows.length > 0 && (
              <div style={{overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.07)'}}>
                <table style={{width: '100%', color: 'var(--text-dark)', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{borderBottom: '1px solid rgba(0,0,0,0.1)'}}>
                      <th style={{padding: '12px', textAlign: 'left'}}>Fila</th>
                      <th style={{padding: '12px', textAlign: 'left'}}>RUT</th>
                      <th style={{padding: '12px', textAlign: 'left'}}>Nombre</th>
                      <th style={{padding: '12px', textAlign: 'left'}}>Curso</th>
                      <th style={{padding: '12px', textAlign: 'left'}}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 25).map((row) => (
                      <tr key={row.index} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                        <td style={{padding: '10px 12px'}}>{row.index}</td>
                        <td style={{padding: '10px 12px'}}>{row.rut || '-'}</td>
                        <td style={{padding: '10px 12px'}}>{row.nombre || '-'}</td>
                        <td style={{padding: '10px 12px'}}>{row.curso || '-'}</td>
                        <td style={{padding: '10px 12px'}}>{row.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 25 && (
                  <p style={{padding: '10px 12px', color: 'var(--text-light)', fontSize: '0.85rem'}}>
                    Mostrando 25 de {previewRows.length} filas para previsualización.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {selectedStudentId && (
        <div className="modal-overlay" onClick={closeDetails} style={{position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
           <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', background: 'white'}}>
              <button 
                onClick={closeDetails} 
                className="action-btn cancel" 
                style={{position: 'absolute', top: '20px', right: '20px', zIndex: 50, cursor: 'pointer'}}
              >
                <X size={20} />
              </button>

              {loadingDetails ? (
                 <div className="loader" style={{margin: '100px auto'}}>Atrayendo expediente...</div>
              ) : studentDetails ? (
                 <div className="fade-in">
                    <h2 style={{color: 'var(--primary)', marginBottom: '5px', marginTop: 0}}>
                      Expediente: {studentDetails.alumno.nombres} {studentDetails.alumno.paterno}
                    </h2>
                    <p style={{color: 'var(--text-light)', marginBottom: '25px', display: 'flex', flexWrap:'wrap', gap:'15px'}}>
                      <span>RUT: {studentDetails.alumno.rut}-{studentDetails.alumno.dv}</span>
                      <span>| Curso: {studentDetails.alumno.grado || 'S/C'}</span>
                      <span>| Escáner ID: <strong style={{color:'var(--text-dark)'}}>{studentDetails.alumno.codigo_barra}</strong></span>
                    </p>

                    <div style={{background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px'}}>
                      <h4 style={{margin: '0 0 10px 0', color: 'var(--text-dark)'}}>Datos Generales Alumno</h4>
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px 14px', fontSize: '0.92rem', color: 'var(--text-dark)'}}>
                        <span><strong>Matrícula:</strong> {formatNullable(studentDetails.alumno.matricula)}</span>
                        <span><strong>Fecha Nacimiento:</strong> {studentDetails.alumno.fecha_nacimiento ? new Date(studentDetails.alumno.fecha_nacimiento).toLocaleDateString('es-CL') : 'N/D'}</span>
                        <span><strong>Sexo:</strong> {formatNullable(studentDetails.alumno.sexo)}</span>
                        <span><strong>Email:</strong> {formatNullable(studentDetails.alumno.email)}</span>
                        <span><strong>Teléfono:</strong> {formatNullable(studentDetails.alumno.telefono)}</span>
                        <span><strong>Dirección:</strong> {formatNullable(studentDetails.alumno.direccion)}</span>
                        <span><strong>Actualización:</strong> {studentDetails.alumno.fecha_actualizacion ? new Date(studentDetails.alumno.fecha_actualizacion).toLocaleString('es-CL') : 'N/D'}</span>
                      </div>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px'}}>
                       <div style={{background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0'}}>
                          <h4 style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginTop:0}}><Users size={18}/> Contactos de Responsables</h4>
                          {(studentDetails.contactosConDetalle || studentDetails.contactos).map((c, i) => (
                             <div key={i} style={{marginBottom: '15px', fontSize: '0.95rem', color: 'var(--text-dark)', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0'}}>
                                <strong>{c.tipo_relacion}: {c.nombres} {c.paterno}</strong> {c.es_contacto_principal && <span style={{color: 'var(--primary)', fontSize:'0.8rem'}}>(Tutor Principal)</span>}<br/>
                                <div style={{marginTop: '4px', color:'var(--text-light)'}}>Tel: {c.telefono} • Email: {c.email || 'N/D'}</div>
                                <div style={{fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px'}}>
                                  Vive c/ alumno: <strong>{c.vive_con_alumno ? 'Sí':'No'}</strong> | 
                                  Derechos de Fotografía: <strong>{c.autoriza_foto ? 'Concedidos':'Negados'}</strong>
                                </div>
                                {c.detalle && (
                                  <div style={{marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-light)'}}>
                                    <div>Fecha nac: {c.detalle.fecha_nacimiento ? new Date(c.detalle.fecha_nacimiento).toLocaleDateString('es-CL') : 'N/D'} | Comuna: {formatNullable(c.detalle.comuna)}</div>
                                    <div>Empresa: {formatNullable(c.detalle.empresa)} | Tel. empresa: {formatNullable(c.detalle.telefono_empresa)}</div>
                                    <div>Estudios: {formatNullable(c.detalle.estudios)} | Profesión: {formatNullable(c.detalle.profesion)} | Nacionalidad: {formatNullable(c.detalle.nacionalidad)}</div>
                                  </div>
                                )}
                             </div>
                          ))}
                          {(studentDetails.contactosConDetalle || studentDetails.contactos).length === 0 && <span style={{fontSize: '0.9rem', color: 'var(--text-light)'}}>Sin información de apoderados.</span>}
                       </div>

                       <div style={{background: '#FEF2F2', padding: '20px', borderRadius: '12px', border: '1px solid #FECACA'}}>
                          <h4 style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', marginTop:0}}><HeartPulse size={18}/> Protocolo Médico</h4>
                          <div style={{fontSize: '0.95rem', color: 'var(--text-dark)'}}>
                             <ul style={{margin: '8px 0 15px 20px', padding: 0}}>
                               <li style={{color: studentDetails.salud?.asma ? '#DC2626' : 'inherit'}}>Asma: {studentDetails.salud?.asma ? 'SÍ' : 'No'}</li>
                               <li style={{color: studentDetails.salud?.diabetes ? '#DC2626' : 'inherit'}}>Diabetes: {studentDetails.salud?.diabetes ? 'SÍ' : 'No'}</li>
                               <li style={{color: studentDetails.salud?.epilepsia ? '#DC2626' : 'inherit'}}>Epilepsia: {studentDetails.salud?.epilepsia ? 'SÍ' : 'No'}</li>
                             </ul>
                             {studentDetails.salud?.observaciones && <p style={{fontStyle:'italic', color: 'var(--text-dark)'}}>Dr: "{studentDetails.salud.observaciones}"</p>}
                             <hr style={{borderColor: '#FECACA', margin: '15px 0'}}/>
                             <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                               <span><strong>Avisar a:</strong> {studentDetails.emergencia?.avisar_a || 'S/D'} (Fono: {studentDetails.emergencia?.telefono_emergencia || '-'})</span>
                               <span><strong>Trasladar a:</strong> <span style={{color:'#DC2626', fontWeight: 'bold'}}>{studentDetails.emergencia?.trasladar_a || 'Ninguno especificado'}</span></span>
                             </div>
                          </div>
                       </div>
                       
                       <div style={{background: '#ECFDF5', padding: '20px', borderRadius: '12px', border: '1px solid #A7F3D0'}}>
                          <h4 style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', marginTop:0}}><DollarSign size={18}/> Status Económico</h4>
                          <div style={{fontSize: '0.95rem', color: 'var(--text-dark)'}}>
                            <div style={{marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(5, 150, 105, 0.25)'}}>
                              <strong>Datos Financieros:</strong>
                              <div style={{marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.88rem'}}>
                                <span><strong>Forma pago:</strong> {formatNullable(studentDetails.finanzas?.forma_pago)}</span>
                                <span><strong>Banco:</strong> {formatNullable(studentDetails.finanzas?.banco)}</span>
                                <span><strong>Tipo cuenta:</strong> {formatNullable(studentDetails.finanzas?.tipo_cuenta)}</span>
                                <span><strong>Número cuenta:</strong> {formatNullable(studentDetails.finanzas?.numero_cuenta)}</span>
                              </div>
                            </div>

                            <strong>Beca de Alimentación (JUNAEB):</strong><br/>
                            {studentDetails.beneficios?.activo ? 
                               <span style={{color: '#059669', fontWeight: 'bold'}}>✅ OFICIAL Y VIGENTE</span> : 
                               <span style={{color: '#DC2626', fontWeight: 'bold'}}>❌ SIN BENEFICIOS FORMALES</span>}
                            
                            {studentDetails.beneficios && (
                              <div style={{marginTop: '10px', padding: '10px 12px', background: 'rgba(5, 150, 105, 0.06)', borderRadius: '8px', border: '1px solid rgba(5, 150, 105, 0.15)'}}>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.88rem'}}>
                                  <span><strong>Desde:</strong> {studentDetails.beneficios.fecha_inicio ? new Date(studentDetails.beneficios.fecha_inicio).toLocaleDateString('es-CL') : 'N/D'}</span>
                                  <span><strong>Hasta:</strong> {studentDetails.beneficios.fecha_fin ? new Date(studentDetails.beneficios.fecha_fin).toLocaleDateString('es-CL') : 'N/D'}</span>
                                </div>
                                {studentDetails.beneficios.motivo_ingreso && (
                                  <div style={{marginTop: '6px', fontSize: '0.88rem'}}><strong>Motivo:</strong> {studentDetails.beneficios.motivo_ingreso}</div>
                                )}
                              </div>
                            )}

                            {studentDetails.restricciones?.length > 0 && (
                              <div style={{marginTop: '12px'}}>
                                <strong>Restricciones Dietarias:</strong>
                                <ul style={{margin: '6px 0 0 18px', padding: 0}}>
                                  {studentDetails.restricciones.map((r, i) => (
                                    <li key={i} style={{color: '#B45309', fontSize: '0.9rem'}}>{r}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <br/>
                            <strong>Programa de Apoyo Escolar (SEP):</strong><br/>
                            Vulnerable: {studentDetails.apoyo?.vulnerable ? 'Sí':'No'} |
                            Prioritario: {studentDetails.apoyo?.prioritario ? 'Sí':'No'} |
                            Preferente: {studentDetails.apoyo?.preferente ? 'Sí':'No'}
                          </div>
                       </div>

                        <div style={{background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0'}}>
                          <h4 style={{marginTop:0, color: 'var(--primary)'}}>Complemento Escolar</h4>
                          <div style={{fontSize: '0.95rem', color: 'var(--text-dark)', display: 'grid', gap: '6px'}}>
                           <span><strong>Lista:</strong> {formatNullable(studentDetails.complemento?.lista)}</span>
                           <span><strong>Estado:</strong> {formatNullable(studentDetails.complemento?.estado)}</span>
                           <span><strong>Foto:</strong> {formatNullable(studentDetails.complemento?.foto)}</span>
                           <span><strong>Condicionalidad:</strong> {formatNullable(studentDetails.complemento?.condicionalidad)}</span>
                           <span><strong>Nacionalidad:</strong> {formatNullable(studentDetails.complemento?.nacionalidad)}</span>
                           <span><strong>Religión:</strong> {formatNullable(studentDetails.complemento?.religion)}</span>
                           <span><strong>Opta religión:</strong> {studentDetails.complemento?.opta_religion === null || studentDetails.complemento?.opta_religion === undefined ? 'N/D' : (studentDetails.complemento.opta_religion ? 'Sí' : 'No')}</span>
                           <span><strong>Colegio procedencia:</strong> {formatNullable(studentDetails.complemento?.colegio_procedencia)}</span>
                           <span><strong>Centro costo:</strong> {formatNullable(studentDetails.complemento?.centro_costo)}</span>
                           <span><strong>Retira titular:</strong> {formatNullable(studentDetails.complemento?.retira_titular)}</span>
                           <span><strong>Retira suplente:</strong> {formatNullable(studentDetails.complemento?.retira_suplente)}</span>
                           <span><strong>Diagnóstico pie:</strong> {studentDetails.complemento?.diagnostico_pie === null || studentDetails.complemento?.diagnostico_pie === undefined ? 'N/D' : (studentDetails.complemento.diagnostico_pie ? 'Sí' : 'No')}</span>
                           <span><strong>Escuela lenguaje:</strong> {studentDetails.complemento?.diagnostico_pie_escuela_lenguaje === null || studentDetails.complemento?.diagnostico_pie_escuela_lenguaje === undefined ? 'N/D' : (studentDetails.complemento.diagnostico_pie_escuela_lenguaje ? 'Sí' : 'No')}</span>
                           <span><strong>Tipo discapacidad pie:</strong> {studentDetails.complemento?.pie_tipo_discapacidad === null || studentDetails.complemento?.pie_tipo_discapacidad === undefined ? 'N/D' : (studentDetails.complemento.pie_tipo_discapacidad ? 'Sí' : 'No')}</span>
                           <span><strong>Etnia indígena:</strong> {formatNullable(studentDetails.complemento?.tx_etnia_indigena)}</span>
                          </div>
                        </div>

                        <div style={{background: '#EFF6FF', padding: '20px', borderRadius: '12px', border: '1px solid #BFDBFE'}}>
                          <h4 style={{marginTop:0, color: '#2563EB'}}>Salud y Emergencia Extendida</h4>
                          <div style={{fontSize: '0.95rem', color: 'var(--text-dark)', display: 'grid', gap: '6px'}}>
                           <div><strong>Peso:</strong> {formatNullable(studentDetails.saludDetalle?.peso)} | <strong>Talla:</strong> {formatNullable(studentDetails.saludDetalle?.talla)} | <strong>Grupo sangre:</strong> {formatNullable(studentDetails.saludDetalle?.grupo_sangre)}</div>
                           <div><strong>Visuales:</strong> {studentDetails.saludDetalle?.problemas_visuales === null || studentDetails.saludDetalle?.problemas_visuales === undefined ? 'N/D' : (studentDetails.saludDetalle.problemas_visuales ? 'Sí' : 'No')} | <strong>Auditivos:</strong> {studentDetails.saludDetalle?.problemas_auditivos === null || studentDetails.saludDetalle?.problemas_auditivos === undefined ? 'N/D' : (studentDetails.saludDetalle.problemas_auditivos ? 'Sí' : 'No')}</div>
                           <div><strong>Cardiacos:</strong> {studentDetails.saludDetalle?.problemas_cardiacos === null || studentDetails.saludDetalle?.problemas_cardiacos === undefined ? 'N/D' : (studentDetails.saludDetalle.problemas_cardiacos ? 'Sí' : 'No')} | <strong>Columna:</strong> {studentDetails.saludDetalle?.problemas_columna === null || studentDetails.saludDetalle?.problemas_columna === undefined ? 'N/D' : (studentDetails.saludDetalle.problemas_columna ? 'Sí' : 'No')}</div>
                           <div><strong>Seguro:</strong> {formatNullable(studentDetails.emergenciaDetalle?.seguro)} | <strong>Isapre:</strong> {formatNullable(studentDetails.emergenciaDetalle?.isapre)}</div>
                           <div><strong>Obs. emergencia:</strong> {formatNullable(studentDetails.emergenciaDetalle?.tx_obs_emergencia)}</div>
                          </div>
                        </div>

                        <div style={{background: '#FFFBEB', padding: '20px', borderRadius: '12px', border: '1px solid #FDE68A'}}>
                          <h4 style={{marginTop:0, color: '#B45309'}}>Datos Bancarios Extendidos</h4>
                          <div style={{fontSize: '0.95rem', color: 'var(--text-dark)', display: 'grid', gap: '6px'}}>
                           <span><strong>Co banco:</strong> {formatNullable(studentDetails.pagoDetalle?.co_banco)}</span>
                           <span><strong>Número tarjeta:</strong> {formatNullable(studentDetails.pagoDetalle?.nu_tarjeta_bancaria)}</span>
                           <span><strong>Vencimiento tarjeta:</strong> {studentDetails.pagoDetalle?.fe_vencimiento_tarjeta ? new Date(studentDetails.pagoDetalle.fe_vencimiento_tarjeta).toLocaleDateString('es-CL') : 'N/D'}</span>
                          </div>
                        </div>
                    </div>

                    {studentDetails.rawExcel && (
                      <details style={{marginTop: '16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 12px'}}>
                        <summary style={{cursor: 'pointer', color: 'var(--text-dark)', fontWeight: 600}}>
                          Ver datos crudos del Excel importado
                        </summary>
                        {studentDetails.rawExcelImportedAt && (
                          <p style={{margin: '8px 0', color: 'var(--text-light)', fontSize: '0.85rem'}}>
                            Última importación: {new Date(studentDetails.rawExcelImportedAt).toLocaleString('es-CL')}
                          </p>
                        )}
                        <div style={{marginTop: '8px', maxHeight: '260px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 10px'}}>
                          {Object.entries(studentDetails.rawExcel).map(([key, value]) => (
                            <div key={key} style={{padding: '4px 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.88rem', color: 'var(--text-dark)'}}>
                              <strong>{key}:</strong> {formatNullable(value)}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                 </div>
              ) : null}
           </div>
        </div>
      )}
    </div>
  );
}

export default Students;
