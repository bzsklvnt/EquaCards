import React, { createContext, useContext, useMemo } from 'react';

export type Session = {
  userId: string;
} | null;

type SessionContextValue = {
  session: Session;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<SessionContextValue>(() => ({ session: null }), []);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
