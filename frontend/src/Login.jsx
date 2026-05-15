import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { AlertCircle, Mail, Lock } from 'lucide-react';
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
    <div className="login-page">
      <div className="login-card">
        {/* Hero logo — full width */}
        <div className="login-hero">
          <img
            src="/CSAC-logo.png"
            alt="Logo Colegio San Agustín"
            className="login-hero-logo"
          />
        </div>

        <div className="login-header">
          <h1 className="login-title">Sistema de Gestión de</h1>
          <h2 className="login-title-accent">Interno</h2>

        </div>

        {errorMsg && (
          <div className="login-error fade-in">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-input-wrapper">
            <Mail size={18} className="login-input-icon" />
            <input
              type="email"
              className="login-input"
              placeholder="Correo electrónico"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>
          <div className="login-input-wrapper">
            <Lock size={18} className="login-input-icon" />
            <input
              type="password"
              className="login-input"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
