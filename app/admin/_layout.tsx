// app/admin/_layout.tsx
import { Redirect, Slot } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const { user, initialized } = useAuth();

  console.log(user, initialized)

  // Amíg a Supabase nem válaszol az indulásnál, mutatunk egy töltőt
  if (!initialized) {
    return (
      <View className="flex-1 justify-center items-center bg-emerald-50">
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  // Ha nincs bejelentkezve, kirúgjuk a login képernyőre
  if (!user) {
    return <Redirect href="../login" />;
  }

  // Ha be van jelentkezve, jöhet a szerkesztő felület
  return <Slot />;
}