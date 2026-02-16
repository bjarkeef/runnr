'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAutoSync } from '@/hooks/useAutoSync';

interface User {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile: string;
  profile_medium: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<void>;
  login: (userData: User) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Auto-sync hook - triggers sync if data is stale (>24 hours)
  const { isSyncing, lastSyncedAt, triggerSync } = useAutoSync(!!user);

  useEffect(() => {
    // Check for user session on mount
    async function checkUserSession() {
      try {
        const res = await fetch('/api/user');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch {
        // Session check failed - user not authenticated
      } finally {
        setLoading(false);
      }
    }
    checkUserSession();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout');
      setUser(null);
    } catch {
      // Logout failed - clear user anyway
      setUser(null);
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, isSyncing, lastSyncedAt, triggerSync, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
