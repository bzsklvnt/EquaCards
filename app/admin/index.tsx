import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const { user } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <Text className="text-2xl font-bold text-emerald-900 mb-4">
        Üdv az Admin felületen!
      </Text>
      <Text className="text-gray-600 mb-8">
        Bejelentkezve: {user?.email}
      </Text>
      
      <TouchableOpacity 
        onPress={handleSignOut}
        className="bg-red-500 px-6 py-3 rounded-lg"
      >
        <Text className="text-white font-bold text-lg">Kijelentkezés</Text>
      </TouchableOpacity>
    </View>
  );
}