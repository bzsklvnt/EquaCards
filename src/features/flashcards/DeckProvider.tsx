import { useQuery } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { fetchCardsWithCategories, fetchCategories } from '@/src/features/flashcards/api';
import type { CategorySummary, StudyCard } from '@/src/features/flashcards/types';
import { isSupabaseConfigured } from '@/src/lib/supabase';

import { useSession } from '../auth/SessionProvider';

type DeckContextValue = {
  categories: CategorySummary[];
  cards: StudyCard[];
  filteredCards: StudyCard[];
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  isLoading: boolean;
  refetchDeck: () => void;
};

const DeckContext = createContext<DeckContextValue | undefined>(undefined);

export function DeckProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const enabled = Boolean(session) && isSupabaseConfigured;

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled,
  });

  const cardsQuery = useQuery({
    queryKey: ['cards'],
    queryFn: fetchCardsWithCategories,
    enabled,
  });

  const categories = categoriesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];

  const filteredCards = useMemo(() => {
    if (!selectedCategoryId) return cards;
    return cards.filter((c) => c.category_id === selectedCategoryId);
  }, [cards, selectedCategoryId]);

  const refetchDeck = useCallback(() => {
    void categoriesQuery.refetch();
    void cardsQuery.refetch();
  }, [categoriesQuery, cardsQuery]);

  const value = useMemo<DeckContextValue>(
    () => ({
      categories,
      cards,
      filteredCards,
      selectedCategoryId,
      setSelectedCategoryId,
      isLoading: categoriesQuery.isLoading || cardsQuery.isLoading,
      refetchDeck,
    }),
    [
      categories,
      cards,
      filteredCards,
      selectedCategoryId,
      categoriesQuery.isLoading,
      cardsQuery.isLoading,
      refetchDeck,
    ],
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck(): DeckContextValue {
  const ctx = useContext(DeckContext);
  if (!ctx) {
    throw new Error('useDeck must be used within DeckProvider');
  }
  return ctx;
}
