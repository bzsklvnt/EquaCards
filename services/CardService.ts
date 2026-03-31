import { supabase } from '../lib/supabase';

export interface Card {
  id?: number;
  category_id: number;
  front_text: string;
  front_image_url?: string;
  back_text: string;
  user_id?: string;
}

export const cardService = {
  
  // 1. KÉP FELTÖLTÉSE A STORAGE-BA
  async uploadImage(uri: string): Promise<string | null> {
    try {
      // React Native-ben a fájlt Blob-bá kell alakítani a feltöltéshez
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileName = `card_${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from('card-images')
        .upload(filePath, blob, {
          contentType: 'image/jpeg'
        });

      if (error) throw error;

      // Publikus URL lekérése
      const { data: publicUrlData } = supabase.storage
        .from('card-images')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Hiba a képfeltöltés során:', error);
      return null;
    }
  },

  // 2. ÚJ KÁRTYA MENTÉSE (Képpel együtt)
  async saveCard(card: Card, imageUri?: string) {
    let finalImageUrl = card.front_image_url;

    // Ha van új kép, először azt töltjük fel
    if (imageUri) {
      const uploadedUrl = await this.uploadImage(imageUri);
      if (uploadedUrl) finalImageUrl = uploadedUrl;
    }

    const { data, error } = await supabase
      .from('cards')
      .insert([{ ...card, front_image_url: finalImageUrl }])
      .select();

    if (error) throw error;
    return data;
  },

  // 3. KÁRTYÁK LEKÉRÉSE (Kategória alapján szűrhető)
  async getCards(categoryId?: number) {
    let query = supabase
      .from('cards')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // 4. KÁRTYA TÖRLÉSE (Adatbázisból ÉS Storage-ból)
  async deleteCard(cardId: number, imageUrl?: string) {
    // Adatbázis sor törlése
    const { error: dbError } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId);

    if (dbError) throw dbError;

    // Ha volt kép, töröljük a Storage-ból is, hogy ne foglalja a helyet
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('card-images').remove([fileName]);
      }
    }
  }
};