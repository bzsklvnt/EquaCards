import React, { createContext, useContext, useMemo } from 'react';

import { useSession } from './SessionProvider';

type AuthorizationValue = {
  roleSlugs: string[];
  hasRole: (slug: string) => boolean;
  hasAnyRole: (slugs: string[]) => boolean;
};

const AuthorizationContext = createContext<AuthorizationValue | undefined>(undefined);

/**
 * Loads role slugs after Supabase session is wired; v1 bootstrap exposes empty roles.
 */
export function AuthorizationProvider({ children }: { children: React.ReactNode }) {
  useSession();

  const value = useMemo<AuthorizationValue>(() => {
    const roleSlugs: string[] = [];
    return {
      roleSlugs,
      hasRole: (slug: string) => roleSlugs.includes(slug),
      hasAnyRole: (slugs: string[]) => slugs.some((s) => roleSlugs.includes(s)),
    };
  }, []);

  return (
    <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>
  );
}

export function useAuthRoles(): string[] {
  const ctx = useAuthorization();
  return ctx.roleSlugs;
}

export function useAuthorization(): AuthorizationValue {
  const ctx = useContext(AuthorizationContext);
  if (!ctx) {
    throw new Error('useAuthorization must be used within AuthorizationProvider');
  }
  return ctx;
}
