import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { Utensils, AlertCircle } from 'lucide-react';
import './index.css';

const Login = () => {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await login(correo, password);
      // Determine where to go based on the user's role: we need the user role string from localstorage 
      // but simpler: navigate to root, the wrapper will redirect to admin if role == admin.
      navigate('/');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setErrorMsg('Credenciales inválidas');
      } else {
        setErrorMsg('Error de red. Intenta más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div className="glass-panel" style={{maxWidth: '400px', width: '100%'}}>
        <div style={{textAlign: 'center', marginBottom: '1.5rem'}}>
          <Utensils size={40} style={{color: 'white', marginBottom: '8px'}} />
          <h2 style={{color: 'white', fontWeight: '600'}}>Sistema de Colaciones</h2>
          <p style={{color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem'}}>Colegio San Agustín</p>
        </div>

        {errorMsg && (
          <div className="alert error fade-in" style={{marginBottom: '1rem'}}>
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Correo electrónico"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              style={{width: '100%', marginBottom: 0}}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{width: '100%'}}
            />
          </div>

          <button type="submit" className="search-btn" disabled={loading} style={{width: '100%', justifyContext: 'center'}}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
