import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const FLIP_MS = 420;

export type FlashCardProps = {
  frontText: string;
  backText: string;
  imageUrl?: string | null;
};

export function FlashCard({ frontText, backText, imageUrl }: FlashCardProps) {
  const rotation = useSharedValue(0);

  const toggle = () => {
    rotation.value = withTiming(rotation.value === 0 ? 180 : 0, { duration: FLIP_MS });
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value - 180}deg` }],
    backfaceVisibility: 'hidden',
  }));

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel="Flip card"
      className="mb-4 w-full"
    >
      <View className="relative min-h-[220px] w-full">
        <Animated.View
          style={[StyleSheet.absoluteFillObject, frontStyle]}
          className="overflow-hidden rounded-2xl border border-equa-sand bg-equa-parchment p-4 dark:border-white/15 dark:bg-equa-leather-deep"
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 12 }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text className="text-base font-semibold text-equa-ink dark:text-equa-cream">
            {frontText}
          </Text>
          <Text className="mt-3 text-xs text-equa-mist dark:text-equa-sand/80">Tap to reveal</Text>
        </Animated.View>

        <Animated.View
          style={[StyleSheet.absoluteFillObject, backStyle]}
          className="items-center justify-center overflow-hidden rounded-2xl border border-equa-meadow/40 bg-equa-cream p-4 dark:border-equa-glade/50 dark:bg-equa-ink"
        >
          <Text className="text-center text-base leading-6 text-equa-leather-deep dark:text-equa-cream">
            {backText}
          </Text>
          <Text className="mt-3 text-xs text-equa-mist dark:text-equa-sand/80">Tap to flip back</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}
