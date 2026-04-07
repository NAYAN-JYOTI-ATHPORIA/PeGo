// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase/FirebaseConfig';

interface AuthContextType {
  user: User | null;
  initializing: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  initializing: true,
});

/**
 * Wraps the app and exposes the current Firebase user (and a loading flag)
 * to any component via useAuth(). Keeps a single source of truth for auth
 * state instead of every screen listening to Firebase separately.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, []);

  return React.createElement(
    AuthContext.Provider,
    { value: { user, initializing } },
    children,
  );
}

/**
 * Hook to access the current user and loading state anywhere in the app.
 * Usage: const { user, initializing } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}