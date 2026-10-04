import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('learnup_admin_token');
    if (token) {
      apiRequest('/auth/me')
        .then((res) => {
          if (res.success && res.data.user) {
            setUser(res.data.user);
          }
        })
        .catch(() => {
          localStorage.removeItem('learnup_admin_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.success && res.data.token) {
      localStorage.setItem('learnup_admin_token', res.data.token);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.error || 'Login failed');
  };

  const logout = () => {
    localStorage.removeItem('learnup_admin_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
