import { useQuery } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useMemo } from 'react';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

import { useSession } from './SessionProvider';

type AuthorizationValue = {
  roleSlugs: string[];
  hasRole: (slug: string) => boolean;
  hasAnyRole: (slugs: string[]) => boolean;
  /** Reserved for permissions table / RPC; v1 returns false for unknown slugs. */
  can: (permission: string) => boolean;
  rolesLoading: boolean;
};

const AuthorizationContext = createContext<AuthorizationValue | undefined>(undefined);

export function AuthorizationProvider({ children }: { children: React.ReactNode }) {
  const { session, initialized: sessionReady } = useSession();

  const { data: roleSlugs = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['my-roles', session?.userId],
    enabled: Boolean(session?.userId) && isSupabaseConfigured && sessionReady,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_roles', {});
      if (error) throw error;
      return data ?? [];
    },
  });

  const hasRole = useCallback(
    (slug: string) => roleSlugs.includes(slug),
    [roleSlugs],
  );

  const hasAnyRole = useCallback(
    (slugs: string[]) => slugs.some((s) => roleSlugs.includes(s)),
    [roleSlugs],
  );

  const can = useCallback((_permission: string) => false, []);

  const value = useMemo<AuthorizationValue>(
    () => ({
      roleSlugs,
      hasRole,
      hasAnyRole,
      can,
      rolesLoading: Boolean(session?.userId) && isSupabaseConfigured && rolesLoading,
    }),
    [roleSlugs, hasRole, hasAnyRole, can, session?.userId, rolesLoading],
  );

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
