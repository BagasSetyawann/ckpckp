import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('si_ckp_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          setUnreadNotifications(res.data.unreadNotifications || 0);
        })
        .catch(() => {
          localStorage.removeItem('si_ckp_token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token, user } = res.data;
    localStorage.setItem('si_ckp_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    return user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('si_ckp_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setUnreadNotifications(res.data.unreadNotifications || 0);
    } catch {}
  };

  const isKPA = user?.role === 'KPA';
  const isKasubbag = user?.role === 'Kasubbag';
  const isAnggota = user?.role === 'Anggota';
  const canManage = isKPA || isKasubbag;

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, refreshUser,
      isKPA, isKasubbag, isAnggota, canManage,
      unreadNotifications, setUnreadNotifications
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
