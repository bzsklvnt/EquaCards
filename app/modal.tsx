import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';

export default function ModalScreen() {
  return (
    <View className="flex-1 min-h-0 w-full max-w-full items-center justify-center px-6">
      <Text className="text-xl font-semibold text-equa-leather-deep dark:text-equa-sand">
        Modal
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}
