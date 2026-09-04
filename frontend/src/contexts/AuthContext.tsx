import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, fetchCurrentUser, logoutUser } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  setSessionUser: (user: UserProfile | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetchCurrentUser();
      setUser(res.authenticated ? res.user : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      // Keep user on the same side or reload
      window.location.reload();
    }
  };

  const isAdmin = !!(user && (user.is_staff || user.role === 'ADMIN'));

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        setSessionUser: (u) => setUser(u),
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
