import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, Utensils, Coffee, Maximize2, Minimize2 } from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner';
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
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const interval = setInterval(() => setClockTime(formatClock()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const mealType = getAutoMealType();
  const mealClass = mealType === 'Desayuno' ? 'kiosk-desayuno' : 'kiosk-almuerzo';
  const MealIcon = mealType === 'Desayuno' ? Coffee : Utensils;

  return (
    <div className={`kiosk-mode ${mealClass}`}>
      <div className="kiosk-panel">
        <div className="kiosk-panel-inner">
        
          <header className="kiosk-header">
            <div className="kiosk-title-group">
              <MealIcon size={36} strokeWidth={2.2} />
              <div>
                <h1>{mealType}</h1>
                <div className="kiosk-meal-subtitle">
                  {mealType === 'Desayuno' ? 'Servicio matutino' : 'Servicio mediodía'}
                </div>
              </div>
            </div>
            <div className="kiosk-header-right">
              <div className="kiosk-clock">
                <Clock size={16} />
                <span>{clockTime}</span>
              </div>
              <button
                onClick={toggleFullscreen}
                className="kiosk-logout-btn"
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {isFullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
              </button>
              <button 
                onClick={() => { logout(); navigate('/login'); }} 
                className="kiosk-logout-btn"
                title="Cerrar sesión"
              >
                <LogOut size={16}/>
              </button>
            </div>
          </header>

          <BarcodeScanner />

        </div>
      </div>
    </div>
  );
}

export default App;
