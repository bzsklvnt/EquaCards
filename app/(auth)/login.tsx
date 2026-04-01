import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (e) setError(e.message);
  };

  const onSignUp = async () => {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (e) setError(e.message);
  };

  if (!isSupabaseConfigured) {
    return (
      <View className="flex-1 justify-center bg-equa-cream px-6 dark:bg-equa-ink">
        <Text className="text-center text-lg font-semibold text-equa-leather-deep dark:text-equa-cream">
          Supabase is not configured
        </Text>
        <Text className="mt-3 text-center text-sm leading-6 text-equa-mist dark:text-equa-sand/80">
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment (see
          .env.example), restart Expo, and run migrations in supabase/migrations.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 w-full justify-center bg-equa-cream px-6 dark:bg-equa-ink"
    >
      <Text className="mb-6 text-center text-3xl font-bold text-equa-leather-deep dark:text-equa-cream">
        EquaCards
      </Text>
      <Text className="mb-2 text-sm text-equa-mist">Email</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        className="mb-4 rounded-xl border border-equa-sand bg-white px-4 py-3 text-equa-ink dark:border-white/15 dark:bg-equa-leather-deep dark:text-equa-cream"
        placeholder="you@example.com"
        placeholderTextColor="#78716C"
      />
      <Text className="mb-2 text-sm text-equa-mist">Password</Text>
      <TextInput
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        className="mb-2 rounded-xl border border-equa-sand bg-white px-4 py-3 text-equa-ink dark:border-white/15 dark:bg-equa-leather-deep dark:text-equa-cream"
        placeholder="••••••••"
        placeholderTextColor="#78716C"
      />
      {error ? (
        <Text className="mb-4 text-sm text-red-600 dark:text-red-300">{error}</Text>
      ) : null}
      <Pressable
        onPress={onSignIn}
        disabled={loading}
        className="mb-3 items-center rounded-xl bg-equa-meadow py-3 dark:bg-equa-glade"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-semibold text-white">Sign in</Text>
        )}
      </Pressable>
      <Pressable onPress={onSignUp} disabled={loading} className="items-center py-2">
        <Text className="text-equa-forest dark:text-equa-glade">Create account</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
