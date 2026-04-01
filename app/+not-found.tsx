import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 min-h-0 w-full max-w-full items-center justify-center p-5">
        <Text className="text-center text-xl font-bold text-equa-leather-deep dark:text-equa-sand">
          This screen does not exist.
        </Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-base text-equa-meadow dark:text-equa-glade">Back to home</Text>
        </Link>
      </View>
    </>
  );
}
