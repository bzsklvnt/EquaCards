import { supabase } from '@/src/lib/supabase';

import type { CategorySummary, StudyCard } from './types';

type CardSelectRow = {
  id: string;
  category_id: string;
  front_text: string;
  answer: string;
  image_url: string | null;
  categories: { id: string; name: string } | null;
};

export async function fetchCategories(): Promise<CategorySummary[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CategorySummary[];
}

export async function fetchCardsWithCategories(): Promise<StudyCard[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, category_id, front_text, answer, image_url, categories (id, name)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data as CardSelectRow[] | null)?.map((row) => ({
    id: row.id,
    category_id: row.category_id,
    front_text: row.front_text,
    answer: row.answer,
    image_url: row.image_url,
    category: row.categories,
  })) ?? [];
}

export type CardInsert = {
  category_id: string;
  front_text: string;
  answer: string;
  image_url?: string | null;
};

export async function insertCard(row: CardInsert, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      category_id: row.category_id,
      front_text: row.front_text,
      answer: row.answer,
      image_url: row.image_url ?? null,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateCard(
  id: string,
  patch: Partial<Pick<CardInsert, 'category_id' | 'front_text' | 'answer' | 'image_url'>>,
): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
}
