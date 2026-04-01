import { Text, View } from '@/components/Themed';
import { View as RNView } from 'react-native';

export default function TabOneScreen() {
  return (
    <View className="flex-1 min-h-0 w-full max-w-full items-center justify-center px-4">
      <Text className="text-xl font-bold text-equa-leather-deep dark:text-equa-sand">
        Tab One
      </Text>
      <RNView className="my-8 h-px w-4/5 max-w-sm bg-equa-sand dark:bg-white/15" />
    </View>
  );
}
