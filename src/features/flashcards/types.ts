export type CategorySummary = {
  id: string;
  name: string;
  sort_order: number;
};

export type StudyCard = {
  id: string;
  category_id: string;
  front_text: string;
  answer: string;
  image_url: string | null;
  category: Pick<CategorySummary, 'id' | 'name'> | null;
};
