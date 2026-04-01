import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ROLE } from '@/src/features/auth/roles';

import { useAuthorization } from './AuthorizationProvider';

type Props = {
  children: ReactNode;
};

/** Redirects non-admins away from admin-only UI (mirrors RLS; does not replace it). */
export function AdminGuard({ children }: Props) {
  const { hasRole, rolesLoading } = useAuthorization();

  if (rolesLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-equa-cream dark:bg-equa-ink">
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  if (!hasRole(ROLE.Admin)) {
    return <Redirect href="/study" />;
  }

  return <>{children}</>;
}
