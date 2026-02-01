
import { jwtDecode } from 'jwt-decode';
import { User, Role } from '../types'; // Import User and Role types

interface JWTPayload {
  userId: number;
  username: string;
  propertyId: number;
  roleId: number;
  iat: number;
  exp: number;
}

export class AuthService {
  private static ACCESS_TOKEN_KEY = 'access_token';
  private static REFRESH_TOKEN_KEY = 'refresh_token';
  private static USER_DATA_KEY = 'user_data'; // Key for storing user object
  private static ROLE_DATA_KEY = 'role_data'; // Key for storing role object
  
  // Store tokens in httpOnly cookies (backend requirement)
  // For demo purposes, use secure sessionStorage/localStorage with encryption
  // (Encryption not implemented for brevity, but understood as a requirement)
  
  static async login(username: string, password: string, rememberMe: boolean): Promise<{ user: User; role: Role; token: string }> {
    // Hash password on client before sending (use bcrypt.js - placeholder for now)
    // For now, return as-is (BACKEND SHOULD HASH)
    const hashedPassword = await this.hashPassword(password);
    
    // Simulating API call to a backend endpoint
    const response = await fetch('/api/auth/login', { // This endpoint is assumed to be handled by a backend
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: hashedPassword }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Authentication failed' }));
        throw new Error(errorData.message || 'Authentication failed');
    }
    
    const { accessToken, refreshToken, user, role } = await response.json();
    
    // Validate JWT before storing
    if (!this.validateToken(accessToken)) {
      throw new Error('Invalid token received');
    }
    
    // Store tokens and user/role data securely
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    storage.setItem(this.USER_DATA_KEY, JSON.stringify(user));
    storage.setItem(this.ROLE_DATA_KEY, JSON.stringify(role));

    if (rememberMe) {
      storage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
    
    return { user, role, token: accessToken };
  }
  
  static validateToken(token: string): boolean {
    if (!token) return false;
    try {
      const decoded = jwtDecode<JWTPayload>(token);
      const now = Date.now() / 1000;
      return decoded.exp > now;
    } catch {
      return false;
    }
  }
  
  static async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    if (!refreshToken) {
        this.logout(); // If no refresh token, force logout
        return null;
    }
    
    try {
      // Simulating API call to a backend endpoint
      const response = await fetch('/api/auth/refresh', { // This endpoint is assumed to be handled by a backend
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (!response.ok) {
          throw new Error('Token refresh failed');
      }
      
      const { accessToken } = await response.json();
      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      // Optionally update user/role data if the refresh endpoint returns it
      return accessToken;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      this.logout(); // On refresh failure, log out
      return null;
    }
  }
  
  static getToken(): string | null {
    let token = sessionStorage.getItem(this.ACCESS_TOKEN_KEY) || 
                  localStorage.getItem(this.ACCESS_TOKEN_KEY);
    
    if (token && this.validateToken(token)) {
      return token;
    }
    
    // If token is expired or not present, try to refresh
    // Note: In a real app, refresh logic would likely be handled by an interceptor
    // or a dedicated background task to avoid blocking UI on every getToken call.
    // For this demo, we'll simplify and return null if no valid token is found.
    return null;
  }

  static getUserAndRole(): { user: User | null; role: Role | null } {
    const userData = sessionStorage.getItem(this.USER_DATA_KEY) || localStorage.getItem(this.USER_DATA_KEY);
    const roleData = sessionStorage.getItem(this.ROLE_DATA_KEY) || localStorage.getItem(this.ROLE_DATA_KEY);
    
    let user: User | null = null;
    let role: Role | null = null;

    if (userData) {
      try {
        user = JSON.parse(userData);
      } catch (error) {
        console.error("Failed to parse user data from storage", error);
        this.logout();
      }
    }
    if (roleData) {
      try {
        role = JSON.parse(roleData);
      } catch (error) {
        console.error("Failed to parse role data from storage", error);
        this.logout();
      }
    }
    return { user, role };
  }
  
  static logout() {
    sessionStorage.clear();
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
    localStorage.removeItem(this.ROLE_DATA_KEY);
  }
  
  private static async hashPassword(password: string): Promise<string> {
    // In a real application, use a proper hashing library like bcrypt.js here
    // For this demo, we'll return the password as-is, assuming the backend handles actual hashing.
    return password;
  }
}
