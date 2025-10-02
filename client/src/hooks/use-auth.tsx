import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string
  username: string
  firstName?: string
  lastName?: string
  email?: string
  department?: string
  isAdmin?: boolean
  roleId?: number | null
  permissions?: {
    [key: string]: {
      view: boolean;
      edit: boolean;
      add: boolean;
      delete?: boolean;
    };
  };
}

interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const res = await fetch('/api/user');
      if (!res.ok) {
        if (res.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch user');
      }
      const userData = await res.json();
      console.log('User data from auth hook:', {
        username: userData?.username,
        isAdmin: userData?.isAdmin,
        roleId: userData?.roleId,
        permissions: userData?.permissions
      });
      return userData;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && error === null) { // User is successfully loaded or not logged in
      setAuthLoading(false);
    } else if (!isLoading && error !== null) { // Error occurred during fetch
      console.error("Error fetching user:", error);
      setAuthLoading(false);
    }
  }, [isLoading, error]);


  const login = (userData: User) => {
    console.log('Login - storing user data:', userData)
    localStorage.setItem('user', JSON.stringify(userData));
    // Redirect to dashboard instead of reloading
    window.location.href = '/';
  }

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (error) {
      console.error('Logout failed:', error)
    }
    console.log('Logout - clearing user data')
    localStorage.removeItem('user');
    // Force a page reload to clear all cached data and redirect to auth
    window.location.href = '/auth';
  }

  const contextValue: AuthContextType = {
    user: user || null, // Ensure user is null if data is undefined or null
    login,
    logout,
    loading: authLoading
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}