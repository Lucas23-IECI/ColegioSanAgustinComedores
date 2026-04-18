import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// Establece que Axios incluya siempre las cookies HttpOnly
axios.defaults.withCredentials = true;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intentar restaurar la sesión desde el backend a través de la cookie HttpOnly
    const checkSession = async () => {
      try {
        const res = await axios.get(`${API_URL}/auth/me`);
        setUser(res.data.user);
      } catch (err) {
        setUser(null); // No hay cookie válida
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = async (correo, password) => {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { correo, password });
      setUser(res.data.user);
      return true;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (err) { }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
