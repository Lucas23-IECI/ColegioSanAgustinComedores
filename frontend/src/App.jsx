import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, CheckCircle, AlertCircle, Utensils, Coffee, Users, List } from 'lucide-react';
import './index.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [rut, setRut] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  
  // New States for Today's Registrations
  const [showToday, setShowToday] = useState(false);
  const [todayList, setTodayList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Fetch today's list when toggle is true
  useEffect(() => {
    if (showToday) {
      fetchTodayRegistrations();
    }
  }, [showToday, successMsg]); // Re-fetch when successMsg changes (new registration)

  const fetchTodayRegistrations = async () => {
    setLoadingList(true);
    try {
      const res = await axios.get(`${API_URL}/lunches/today`);
      setTodayList(res.data);
    } catch (err) {
      console.error('Error fetching today list', err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setStudent(null);
    setAlreadyRegistered(false);

    try {
      const res = await axios.get(`${API_URL}/students/${rut}`, {
        params: { meal_type: mealType }
      });
      setStudent(res.data.student);
      setAlreadyRegistered(res.data.alreadyRegistered);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('Estudiante no encontrado. Verifica el RUT.');
      } else {
        setError('Error de conexión con el servidor.');
      }
    } finally {
      setLoading(false);
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
      setSuccessMsg('¡Registro exitoso!');
      setAlreadyRegistered(true);
    } catch (err) {
      setError('Error al registrar. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp to local time
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container">
      <div className="glass-panel">
        <header className="header">
          <h1>Registro de Alimentación</h1>
          <p>Sistema Escolar</p>
        </header>

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
              type="text" 
              placeholder="Ingrese RUT (ej. 12345678-9)" 
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} className="search-btn">
              <Search size={20} />
            </button>
          </div>
        </form>

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

        {/* View Today Component */}
        <button 
          className="toggle-view-btn" 
          onClick={() => setShowToday(!showToday)}
        >
          <List size={18} /> 
          {showToday ? 'Ocultar Registros del Día' : 'Ver Registros del Día'}
        </button>

        {showToday && (
          <div className="registrations-container fade-in">
            <h3>
              Total Hoy: {todayList.length}
              {loadingList && <span className="loader" style={{marginBottom: 0, fontSize: '0.8rem'}}> (Cargando...)</span>}
            </h3>
            
            {todayList.length === 0 && !loadingList ? (
              <p style={{textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem', marginTop: '10px'}}>
                No hay registros el día de hoy.
              </p>
            ) : (
              <div className="registrations-list">
                {todayList.map((reg, idx) => (
                  <div key={idx} className="registration-card">
                    <div className="registration-info">
                      <h4>{reg.name}</h4>
                      <p>{reg.rut} • {reg.grade}</p>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'}}>
                      <span className={`meal-badge ${reg.meal_type}`}>
                        {reg.meal_type === 'lunch' ? 'Almuerzo' : 'Desayuno'}
                      </span>
                      <span style={{fontSize: '0.75rem', color: 'var(--text-light)'}}>
                        {formatTime(reg.timestamp)}
                      </span>
                    </div>
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
