import { Redirect } from 'expo-router';

import { useSession } from '@/src/features/auth/SessionProvider';

export default function Index() {
  const { session } = useSession();
  if (!session) {
    return <Redirect href="/login" />;
  }
  return <Redirect href="/study" />;
}
