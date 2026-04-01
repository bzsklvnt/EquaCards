import { FlashList } from '@shopify/flash-list';
import { Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native';

import { FlashCard } from '@/src/components/FlashCard';
import { useDeck } from '@/src/features/flashcards/DeckProvider';
import { isSupabaseConfigured } from '@/src/lib/supabase';

export default function StudyScreen() {
  const {
    filteredCards,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    isLoading,
  } = useDeck();

  if (!isSupabaseConfigured) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-equa-mist">Configure Supabase to load the catalog.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 min-h-0 w-full px-4 pt-4">
      <Text className="mb-2 text-2xl font-bold text-equa-leather-deep dark:text-equa-cream">
        Study
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3 max-h-11"
        contentContainerStyle={{ alignItems: 'center', paddingRight: 8 }}
      >
        <Pressable
          onPress={() => setSelectedCategoryId(null)}
          className={`mr-2 rounded-full px-3 py-1.5 ${
            selectedCategoryId === null
              ? 'bg-equa-meadow dark:bg-equa-glade'
              : 'bg-equa-sand/70 dark:bg-white/10'
          }`}
        >
          <Text
            className={`text-sm ${
              selectedCategoryId === null ? 'font-semibold text-white' : 'text-equa-ink dark:text-equa-cream'
            }`}
          >
            All
          </Text>
        </Pressable>
        {categories.map((c) => {
          const selected = c.id === selectedCategoryId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setSelectedCategoryId(c.id)}
              className={`mr-2 rounded-full px-3 py-1.5 ${
                selected ? 'bg-equa-meadow dark:bg-equa-glade' : 'bg-equa-sand/70 dark:bg-white/10'
              }`}
            >
              <Text
                className={`text-sm ${
                  selected ? 'font-semibold text-white' : 'text-equa-ink dark:text-equa-cream'
                }`}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#047857" />
        </View>
      ) : (
        <View className="min-h-0 flex-1 w-full">
          <FlashList
            data={filteredCards}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <Text className="mt-8 text-center text-equa-mist dark:text-equa-sand/80">
                No cards in this filter yet.
              </Text>
            }
            renderItem={({ item }) => (
              <FlashCard
                frontText={item.front_text}
                backText={item.answer}
                imageUrl={item.image_url}
              />
            )}
          />
        </View>
      )}
    </View>
  );
}
