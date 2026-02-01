
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { AuthService } from '../services/auth.service';
import { logActivity } from '../services/apiService'; // Assuming logActivity remains in apiService

interface AuthContextType {
  user: User | null;
  role: Role | null;
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>;
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
    const initAuth = async () => {
      setLoading(true);
      const storedToken = AuthService.getToken();
      
      if (storedToken) {
        const { user: storedUser, role: storedRole } = AuthService.getUserAndRole();

        if (storedUser && storedRole && AuthService.validateToken(storedToken)) {
          // Attempt to fetch fresh user data from backend using token
          // This simulates a 'me' endpoint to get up-to-date user/role info
          try {
            const response = await fetch('/api/auth/me', { // Placeholder: this endpoint would typically be handled by a real backend
              headers: { 'Authorization': `Bearer ${storedToken}` }
            });
            
            if (response.ok) {
              const { user: fetchedUser, role: fetchedRole } = await response.json();
              setUser(fetchedUser);
              setRole(fetchedRole);
              setToken(storedToken);
            } else {
              // Token might be valid but backend session invalid or user changed
              AuthService.logout();
              setUser(null);
              setRole(null);
              setToken(null);
            }
          } catch (error) {
            console.error("Session restoration (AuthService.initAuth) failed:", error);
            AuthService.logout();
            setUser(null);
            setRole(null);
            setToken(null);
          }
        } else {
          // Token expired or data corrupted, force logout
          AuthService.logout();
          setUser(null);
          setRole(null);
          setToken(null);
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []); // Run only once on mount

  const login = async (username: string, password: string, rememberMe: boolean) => {
    try {
      const { user: loggedInUser, role: loggedInRole, token: accessToken } = await AuthService.login(username, password, rememberMe);
      
      setUser(loggedInUser);
      setRole(loggedInRole);
      setToken(accessToken);
      
      // Log activity after successful login
      await logActivity(loggedInUser.username, 'User Authenticated', { 
        module: 'auth', 
        actionType: 'LOGIN',
        userId: loggedInUser.id,
        userRole: loggedInRole.name
      });
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Re-throw to be caught by LoginPage for error display
    }
  };

  const logout = () => {
    if (user) {
      // Log activity before clearing session
      logActivity(user.username, 'Session Terminated', { 
        module: 'auth', 
        actionType: 'LOGOUT',
        userId: user.id,
        userRole: role?.name
      });
    }
    
    AuthService.logout();
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
