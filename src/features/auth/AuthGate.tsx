import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { isSupabaseConfigured } from '@/src/lib/supabase';

import { useSession } from './SessionProvider';

const PUBLIC_PREFIXES = ['/login'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Keeps unauthenticated users on /login and signed-in users out of the auth stack.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, initialized } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    if (!isSupabaseConfigured) {
      if (pathname !== '/login') {
        router.replace('/login');
      }
      return;
    }

    const onLogin = pathname === '/login';
    if (!session && !isPublicPath(pathname)) {
      router.replace('/login');
      return;
    }
    if (session && onLogin) {
      router.replace('/study');
    }
  }, [initialized, pathname, router, session]);

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-equa-cream dark:bg-equa-ink">
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return <>{children}</>;
}
