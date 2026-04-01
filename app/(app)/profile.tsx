import { useQuery } from '@tanstack/react-query';
import { Text, View, Pressable, ActivityIndicator } from 'react-native';

import { useAuthRoles } from '@/src/features/auth/AuthorizationProvider';
import { useSession } from '@/src/features/auth/SessionProvider';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export default function ProfileScreen() {
  const { session } = useSession();
  const roles = useAuthRoles();

  const profileQuery = useQuery({
    queryKey: ['profile', session?.userId],
    enabled: Boolean(session?.userId) && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, updated_at')
        .eq('id', session!.userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View className="flex-1 w-full px-6 py-6">
      <Text className="mb-4 text-2xl font-bold text-equa-leather-deep dark:text-equa-cream">
        Profile
      </Text>
      <Text className="mb-1 text-sm text-equa-mist">Signed in as</Text>
      <Text className="mb-4 text-base text-equa-ink dark:text-equa-cream">{session?.email ?? '—'}</Text>

      {profileQuery.isLoading ? (
        <ActivityIndicator color="#047857" />
      ) : (
        <>
          <Text className="mb-1 text-sm text-equa-mist">Display name</Text>
          <Text className="mb-4 text-base text-equa-ink dark:text-equa-cream">
            {profileQuery.data?.display_name ?? '—'}
          </Text>
        </>
      )}

      <Text className="mb-1 text-sm text-equa-mist">Roles</Text>
      <Text className="mb-6 text-base text-equa-ink dark:text-equa-cream">
        {roles.length ? roles.join(', ') : '—'}
      </Text>

      <Pressable
        onPress={onSignOut}
        className="items-center rounded-xl border border-equa-sand py-3 dark:border-white/15"
      >
        <Text className="font-semibold text-equa-leather-deep dark:text-equa-cream">Sign out</Text>
      </Pressable>
    </View>
  );
}
