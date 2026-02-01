
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { logActivity } from '../services/apiService';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  login: (user: User, role: Role, token: string, rememberMe: boolean) => void;
  logout: () => void;
  loading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let storedUser: string | null = null;
    let storedRole: string | null = null;
    let storedToken: string | null = null;
    
    storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    storedRole = localStorage.getItem('role') || sessionStorage.getItem('role');
    storedToken = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (storedUser && storedToken && storedRole) {
      try {
        setUser(JSON.parse(storedUser));
        setRole(JSON.parse(storedRole));
        setToken(storedToken);
      } catch (error) {
        console.error("Failed to parse session from storage");
        sessionStorage.clear();
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = (userData: User, roleData: Role, token: string, rememberMe: boolean) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('user', JSON.stringify(userData));
    storage.setItem('role', JSON.stringify(roleData));
    storage.setItem('token', token);
    
    setUser(userData);
    setRole(roleData);
    setToken(token);
    logActivity(userData.username, 'User Authenticated', { module: 'auth', actionType: 'LOGIN' });
  };

  const logout = () => {
    if(user) {
      logActivity(user.username, 'Session Terminated', { module: 'auth', actionType: 'LOGOUT' });
    }
    sessionStorage.clear();
    localStorage.clear();
    setUser(null);
    setRole(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};