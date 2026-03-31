import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Hiba a belépésnél', error.message);
      setLoading(false);
    } else {
      // Sikeres belépés után irány az admin felület
      router.navigate('/admin' as any);
    }
  }

  return (
    <View className="flex-1 justify-center px-6 bg-emerald-50">
      <Text className="text-3xl font-bold text-emerald-900 mb-8 text-center">Admin Belépés</Text>
      
      <View className="bg-white p-6 rounded-2xl shadow-sm">
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-gray-800"
          placeholder="Email cím"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-gray-800"
          placeholder="Jelszó"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          className="bg-emerald-700 p-4 rounded-lg items-center"
          disabled={loading}
          onPress={signInWithEmail}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-lg">Belépés</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}