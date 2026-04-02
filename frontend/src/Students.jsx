import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, X, HeartPulse, Filter, DollarSign, Users, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './index.css';

const API_URL = 'http://localhost:5000/api';

function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  
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

  return (
    <div className="app-container">
      <div className="glass-panel" style={{maxWidth: '1000px', width: '100%'}}>
        
        <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
           <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
              <button 
                onClick={() => {
                   if (selectedCourse) setSelectedCourse(null);
                   else navigate('/admin');
                }} 
                className="action-btn" 
                style={{backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: '8px', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.2)'}}
              >
                <ChevronLeft size={20} />
              </button>
              <h2 style={{color: 'var(--text-dark)', margin: 0}}>
                 {selectedCourse ? `Alumnos: ${selectedCourse}` : 'Listado de Cursos'}
              </h2>
           </div>
        </header>

        {loading ? (
          <div className="loader">Cargando padrón...</div>
        ) : !selectedCourse ? (
          <div className="fade-in">
             <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>
                Selecciona la nómina de un curso para inspeccionar su universo de alumnos.
             </p>
             <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px'}}>
                
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

                <div 
                  className="registration-card"
                  style={{padding: '20px', cursor: 'pointer', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)', background: 'rgba(59, 130, 246, 0.05)'}}
                  onClick={() => setSelectedCourse('Toda La Matrícula')}
                >
                  <Users size={32} color="#3b82f6" style={{marginBottom: '10px'}}/>
                  <h3 style={{color: 'var(--text-dark)', margin: '0 0 5px 0'}}>Todos los Alumnos</h3>
                  <p style={{color: 'var(--text-light)', margin: 0}}>Padrón Global ({students.length})</p>
                </div>
             </div>
          </div>
        ) : (
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

             <div style={{overflowX: 'auto'}}>
               <table style={{width: '100%', color: 'var(--text-dark)', borderCollapse: 'collapse'}}>
                 <thead>
                   <tr style={{borderBottom: '1px solid rgba(0,0,0,0.1)'}}>
                     <th style={{padding: '12px', textAlign: 'left'}}>RUT</th>
                     <th style={{padding: '12px', textAlign: 'left'}}>Nombre Completo</th>
                     {selectedCourse === 'Toda La Matrícula' && <th style={{padding: '12px', textAlign: 'left'}}>Curso</th>}
                     <th style={{padding: '12px', textAlign: 'center'}}>Estado Institucional</th>
                     <th style={{padding: '12px', textAlign: 'right'}}>Acción</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filtered.map(s => (
                     <tr key={s.id} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                       <td style={{padding: '12px'}}>{s.rut}</td>
                       <td style={{padding: '12px'}}>{s.name}</td>
                       {selectedCourse === 'Toda La Matrícula' && <td style={{padding: '12px'}}>{s.grade || 'Sin Curso'}</td>}
                       <td style={{padding: '12px', textAlign: 'center'}}>
                          {s.activo ? 
                            <span style={{background: '#ECFDF5', color: '#059669', padding:'4px 8px', borderRadius:'12px', fontSize:'0.8rem'}}>Matrícula Activa</span> : 
                            <span style={{background: '#FEF2F2', color: '#DC2626', padding:'4px 8px', borderRadius:'12px', fontSize:'0.8rem'}}>Baja / Retirado</span>}
                       </td>
                       <td style={{padding: '12px', textAlign: 'right'}}>
                          <button onClick={() => openDetails(s.id)} className="action-btn edit">
                            Ver Ficha Local
                          </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               {filtered.length === 0 && <p style={{textAlign: 'center', marginTop: '20px', color: 'var(--text-light)'}}>No hay estudiantes coincidentes en esta nómina.</p>}
             </div>
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

                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px'}}>
                       <div style={{background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0'}}>
                          <h4 style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginTop:0}}><Users size={18}/> Contactos de Responsables</h4>
                          {studentDetails.contactos.map((c, i) => (
                             <div key={i} style={{marginBottom: '15px', fontSize: '0.95rem', color: 'var(--text-dark)', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0'}}>
                                <strong>{c.tipo_relacion}: {c.nombres} {c.paterno}</strong> {c.es_contacto_principal && <span style={{color: 'var(--primary)', fontSize:'0.8rem'}}>(Tutor Principal)</span>}<br/>
                                <div style={{marginTop: '4px', color:'var(--text-light)'}}>Tel: {c.telefono} • Email: {c.email || 'N/D'}</div>
                                <div style={{fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px'}}>
                                  Vive c/ alumno: <strong>{c.vive_con_alumno ? 'Sí':'No'}</strong> | 
                                  Derechos de Fotografía: <strong>{c.autoriza_foto ? 'Concedidos':'Negados'}</strong>
                                </div>
                             </div>
                          ))}
                          {studentDetails.contactos.length === 0 && <span style={{fontSize: '0.9rem', color: 'var(--text-light)'}}>Sin información de apoderados.</span>}
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
                            <strong>Beca de Alimentación:</strong><br/>
                            {studentDetails.beneficios?.activo ? 
                               <span style={{color: '#059669', fontWeight: 'bold'}}>OFICIAL Y VIGENTE</span> : 
                               <span style={{color: '#DC2626', fontWeight: 'bold'}}>SIN BENEFICIOS FORMALES</span>}
                            <br/><br/>
                            <strong>Programa de Apoyo Escolar (SEP):</strong><br/>
                            Vulnerable: {studentDetails.apoyo?.vulnerable ? 'Sí':'No'} |
                            Prioritario: {studentDetails.apoyo?.prioritario ? 'Sí':'No'} |
                            Preferente: {studentDetails.apoyo?.preferente ? 'Sí':'No'}
                          </div>
                       </div>
                    </div>
                 </div>
              ) : null}
           </div>
        </div>
      )}
    </div>
  );
}

export default Students;
