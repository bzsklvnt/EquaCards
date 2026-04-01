import type { Session as SupabaseSession } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export type Session = {
  userId: string;
  email: string | null;
} | null;

type SessionContextValue = {
  session: Session;
  initialized: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function mapSession(s: SupabaseSession | null): Session {
  if (!s?.user) return null;
  return { userId: s.user.id, email: s.user.email ?? null };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitialized(true);
      return;
    }

    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSession(mapSession(s));
        setInitialized(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(mapSession(s));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      initialized,
    }),
    [session, initialized],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
