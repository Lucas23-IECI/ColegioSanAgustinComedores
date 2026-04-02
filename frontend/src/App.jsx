import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { List, Clock, LogOut } from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner';
import HistoryPanel from './components/HistoryPanel';
import './index.css';

function getAutoMealType() {
  const hour = new Date().getHours();
  return hour < 13 ? 'Desayuno' : 'Almuerzo';
}

function formatClock() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function App() {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [clockTime, setClockTime] = useState(formatClock());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setClockTime(formatClock()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      <div className="glass-panel">
        
        {/* Cabecera Centralizada */}
        <header className="header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h1>Lector de Alimentación</h1>
            <div className="header-clock">
              <Clock size={14} />
              <span>{clockTime} — {getAutoMealType()}</span>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="action-btn cancel" style={{display: 'flex', gap: '4px'}}>
            <LogOut size={16}/> Salir
          </button>
        </header>

        {/* Módulo Escáner Independiente */}
        <BarcodeScanner />

        {/* Controles y Panel de Historial Independiente */}
        <button 
          className="toggle-view-btn" 
          onClick={() => setShowHistory(!showHistory)} 
          style={{marginTop: '20px'}}
        >
          <List size={18} />
          {showHistory ? 'Ocultar Historial del Día' : 'Ver Historial'}
        </button>

        {showHistory && <HistoryPanel />}

      </div>
    </div>
  );
}

export default App;
