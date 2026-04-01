import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteCard,
  fetchCardsWithCategories,
  fetchCategories,
  insertCard,
  updateCard,
} from '@/src/features/flashcards/api';
import type { CategorySummary, StudyCard } from '@/src/features/flashcards/types';
import { pickCardImage } from '@/src/lib/pickImage';
import { uploadCardImage } from '@/src/lib/uploadCardImage';

import { useSession } from '../auth/SessionProvider';
import { useDraftRows } from './useDraftRows';

type DraftShape = {
  category_id: string;
  front_text: string;
  answer: string;
  image_url: string | null;
};

function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: CategorySummary[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 max-h-10">
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
            className={`mr-2 rounded-full px-3 py-1 ${
              selected
                ? 'bg-equa-meadow dark:bg-equa-glade'
                : 'bg-equa-sand/60 dark:bg-white/10'
            }`}
          >
            <Text
              className={`text-sm ${selected ? 'font-semibold text-white' : 'text-equa-ink dark:text-equa-cream'}`}
            >
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PersistedCardRow({
  card,
  categories,
  userId,
}: {
  card: StudyCard;
  categories: CategorySummary[];
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState(card.category_id);
  const [front, setFront] = useState(card.front_text);
  const [answer, setAnswer] = useState(card.answer);
  const [imageUrl, setImageUrl] = useState(card.image_url);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateCard(card.id, {
        category_id: categoryId,
        front_text: front.trim(),
        answer: answer.trim(),
        image_url: imageUrl,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCard(card.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  const onPickImage = async () => {
    const picked = await pickCardImage();
    if (!picked) return;
    try {
      const url = await uploadCardImage(userId, picked);
      setImageUrl(url);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload image');
    }
  };

  return (
    <View className="mb-4 rounded-xl border border-equa-sand bg-white p-3 dark:border-white/10 dark:bg-equa-leather-deep">
      <Text className="mb-1 text-xs font-semibold uppercase text-equa-mist">Category</Text>
      <CategoryChips categories={categories} value={categoryId} onChange={setCategoryId} />
      <Text className="mb-1 text-xs font-semibold uppercase text-equa-mist">Front</Text>
      <TextInput
        value={front}
        onChangeText={setFront}
        multiline
        className="mb-2 min-h-[48px] rounded-lg border border-equa-sand bg-equa-cream/40 px-3 py-2 text-equa-ink dark:border-white/15 dark:bg-equa-ink dark:text-equa-cream"
        placeholderTextColor="#78716C"
      />
      <Text className="mb-1 text-xs font-semibold uppercase text-equa-mist">Answer</Text>
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        multiline
        className="mb-2 min-h-[48px] rounded-lg border border-equa-sand bg-equa-cream/40 px-3 py-2 text-equa-ink dark:border-white/15 dark:bg-equa-ink dark:text-equa-cream"
        placeholderTextColor="#78716C"
      />
      <View className="mb-2 flex-row items-center gap-3">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 72, height: 72, borderRadius: 8 }}
            contentFit="cover"
          />
        ) : (
          <View className="h-[72px] w-[72px] items-center justify-center rounded-lg bg-equa-sand/50 dark:bg-white/10">
            <Text className="text-xs text-equa-mist">No image</Text>
          </View>
        )}
        <Pressable
          onPress={onPickImage}
          className="rounded-lg bg-equa-parchment px-3 py-2 dark:bg-white/10"
        >
          <Text className="text-sm text-equa-leather-deep dark:text-equa-cream">Image</Text>
        </Pressable>
      </View>
      <View className="mt-1 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-equa-meadow px-4 py-2 dark:bg-equa-glade"
        >
          <Text className="font-semibold text-white">
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert('Delete card', 'Remove this card?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteMutation.mutate(),
              },
            ]);
          }}
          className="rounded-lg border border-red-200 px-4 py-2 dark:border-red-400/40"
        >
          <Text className="text-red-700 dark:text-red-300">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AdminCardsScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.userId ?? '';

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const cardsQuery = useQuery({
    queryKey: ['cards'],
    queryFn: fetchCardsWithCategories,
  });

  const categories = categoriesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];

  const createEmpty = useCallback(
    (): DraftShape => ({
      category_id: categories[0]?.id ?? '',
      front_text: '',
      answer: '',
      image_url: null,
    }),
    [categories],
  );

  const { draftRow, setDraftRow, resetDraft } = useDraftRows<DraftShape>(createEmpty);

  useEffect(() => {
    if (!draftRow.category_id && categories[0]?.id) {
      setDraftRow((r) => ({ ...r, category_id: categories[0].id }));
    }
  }, [categories, draftRow.category_id, setDraftRow]);

  const insertMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');
      await insertCard(
        {
          category_id: draftRow.category_id,
          front_text: draftRow.front_text.trim(),
          answer: draftRow.answer.trim(),
          image_url: draftRow.image_url,
        },
        userId,
      );
    },
    onSuccess: () => {
      resetDraft();
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  const onPickDraftImage = async () => {
    const picked = await pickCardImage();
    if (!picked || !userId) return;
    try {
      const url = await uploadCardImage(userId, picked);
      setDraftRow((r) => ({ ...r, image_url: url }));
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload image');
    }
  };

  const canSaveDraft = useMemo(() => {
    return (
      Boolean(draftRow.category_id) &&
      draftRow.front_text.trim().length > 0 &&
      draftRow.answer.trim().length > 0
    );
  }, [draftRow]);

  if (categoriesQuery.isLoading || cardsQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 w-full px-4 py-4"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text className="mb-1 text-2xl font-bold text-equa-leather-deep dark:text-equa-cream">
        Manage cards
      </Text>
      <Text className="mb-4 text-sm text-equa-mist">
        Edits sync to Supabase; only admins pass RLS.
      </Text>

      {cards.map((c) => (
        <PersistedCardRow key={c.id} card={c} categories={categories} userId={userId} />
      ))}

      <View className="rounded-xl border-2 border-dashed border-equa-meadow/50 bg-equa-parchment/40 p-3 dark:border-equa-glade/40 dark:bg-equa-ink">
        <Text className="mb-2 text-sm font-semibold text-equa-forest dark:text-equa-glade">
          New card
        </Text>
        <CategoryChips
          categories={categories}
          value={draftRow.category_id}
          onChange={(id) => setDraftRow((r) => ({ ...r, category_id: id }))}
        />
        <Text className="mb-1 text-xs font-semibold uppercase text-equa-mist">Front</Text>
        <TextInput
          value={draftRow.front_text}
          onChangeText={(t) => setDraftRow((r) => ({ ...r, front_text: t }))}
          multiline
          className="mb-2 min-h-[48px] rounded-lg border border-equa-sand bg-white px-3 py-2 text-equa-ink dark:border-white/15 dark:bg-equa-leather-deep dark:text-equa-cream"
          placeholder="Prompt / question"
          placeholderTextColor="#78716C"
        />
        <Text className="mb-1 text-xs font-semibold uppercase text-equa-mist">Answer</Text>
        <TextInput
          value={draftRow.answer}
          onChangeText={(t) => setDraftRow((r) => ({ ...r, answer: t }))}
          multiline
          className="mb-2 min-h-[48px] rounded-lg border border-equa-sand bg-white px-3 py-2 text-equa-ink dark:border-white/15 dark:bg-equa-leather-deep dark:text-equa-cream"
          placeholder="Answer"
          placeholderTextColor="#78716C"
        />
        <View className="mb-2 flex-row items-center gap-3">
          {draftRow.image_url ? (
            <Image
              source={{ uri: draftRow.image_url }}
              style={{ width: 72, height: 72, borderRadius: 8 }}
              contentFit="cover"
            />
          ) : null}
          <Pressable
            onPress={onPickDraftImage}
            className="rounded-lg bg-equa-meadow/15 px-3 py-2 dark:bg-equa-glade/20"
          >
            <Text className="text-sm text-equa-forest dark:text-equa-glade">Add image</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => insertMutation.mutate()}
          disabled={!canSaveDraft || insertMutation.isPending}
          className={`items-center rounded-lg py-3 ${
            canSaveDraft ? 'bg-equa-meadow dark:bg-equa-glade' : 'bg-equa-sand dark:bg-white/10'
          }`}
        >
          <Text className="font-semibold text-white">
            {insertMutation.isPending ? 'Creating…' : 'Create card'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
