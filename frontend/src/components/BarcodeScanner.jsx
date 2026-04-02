import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, CheckCircle, AlertCircle, Utensils, Coffee, Zap, Activity } from 'lucide-react';
import { playBeep } from '../utils/audioNotifier';

const API_URL = 'http://localhost:5000/api';

function getAutoMealType() {
  const hour = new Date().getHours();
  return hour < 13 ? 'desayuno' : 'almuerzo';
}

const BarcodeScanner = () => {
  const [rut, setRut] = useState('');
  const [mealType, setMealType] = useState(getAutoMealType);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [esBeneficiario, setEsBeneficiario] = useState(true);
  const [restricciones, setRestricciones] = useState([]);
  
  const [scannerMode, setScannerMode] = useState(true);
  
  const inputRef = useRef(null);
  const autoResetTimer = useRef(null);
  const isProcessing = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
        setRestricciones([]);
        setEsBeneficiario(true);
        focusInput();
      }, 4000);
    }
    return () => clearTimeout(autoResetTimer.current);
  }, [successMsg, error, alreadyRegistered, focusInput]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const barcode = rut.trim();
    if (!barcode) return;
    if (isProcessing.current) return;
    isProcessing.current = true;

    setRut('');
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setStudent(null);
    setAlreadyRegistered(false);
    setRestricciones([]);

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

      if (scannerMode && !isAlreadyReg) {
        await autoRegister(foundStudent, res.data.esBeneficiario);
      } else if (isAlreadyReg) {
        playBeep('warning');
      }
    } catch (err) {
      if (err.response && err.response.status === 403) {
         setError(err.response.data.message); // Alumno inactivo
      } else if (err.response && err.response.status === 404) {
        setError('Código no encontrado en el sistema.');
      } else {
        setError('Error de conexión con el servidor.');
      }
      playBeep('error');
    } finally {
      setLoading(false);
      isProcessing.current = false;
    }
  };

  const autoRegister = async (studentData, benefStatus) => {
    try {
      await axios.post(`${API_URL}/lunches`, {
        id_alumno: studentData.id_alumno,
        tipo_alimentacion: mealType
      });
      setSuccessMsg(`${studentData.nombres} registrado (${!benefStatus ? 'Uso Registrado' : 'Beneficiario'}).`);
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
        id_alumno: student.id_alumno,
        tipo_alimentacion: mealType
      });
      setSuccessMsg(`${student.nombres} registrado!`);
      setAlreadyRegistered(true);
      playBeep('success');
    } catch (err) {
      setError('Error al registrar. Intenta nuevamente.');
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
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
            className={`meal-btn ${mealType === 'desayuno' ? 'active' : ''}`}
            onClick={() => { setMealType('desayuno'); setStudent(null); setError(''); setSuccessMsg(''); setRestricciones([]); }}
          >
            <Coffee size={20} /> Desayuno
          </button>
          <button
            type="button"
            className={`meal-btn ${mealType === 'almuerzo' ? 'active' : ''}`}
            onClick={() => { setMealType('almuerzo'); setStudent(null); setError(''); setSuccessMsg(''); setRestricciones([]); }}
          >
            <Utensils size={20} /> Almuerzo
          </button>
        </div>

        <div className="input-group">
          <input
            ref={inputRef}
            type="text"
            placeholder={scannerMode ? 'Escanee código...' : 'Ingrese código manual...'}
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

      {loading && <div className="loader">Procesando...</div>}

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

      {student && (
        <div className="student-card fade-in" style={{border: !esBeneficiario ? '1px solid rgba(255, 165, 0, 0.5)' : 'none'}}>
          <div className="student-info">
            <h2>{student.nombres} {student.paterno} {student.materno}</h2>
            <p>Curso: <strong>{student.nombre_curso || 'Sin Curso Asignado'}</strong></p>
            <p>RUT: {student.rut}-{student.dv}</p>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px'}}>
              {!esBeneficiario && (
                <div className="status-badge" style={{backgroundColor: 'rgba(255, 165, 0, 0.2)', color: 'orange'}}>
                    <AlertCircle size={16} /> Estudiante No Beneficiario (Reportado)
                </div>
              )}
              {restricciones.length > 0 && (
                <div className="status-badge error" style={{backgroundColor: 'var(--danger-color)', color: 'white'}}>
                    <Activity size={16} /> Restricción Dieta: {restricciones.join(', ')}
                </div>
              )}
          </div>

          {alreadyRegistered ? (
            <div className="status-badge warning">
              <AlertCircle size={16} /> Ya registrado para {mealType} hoy
            </div>
          ) : !scannerMode ? (
            <button onClick={handleRegister} className="register-btn" disabled={loading}>
              Confirmar Colación
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
