import { supabase } from '@/src/lib/supabase';

import type { PickedImage } from './pickImage';

const BUCKET = 'card-images';

function extensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

function randomPath(userId: string, mime: string): string {
  const id =
    typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${id}.${extensionForMime(mime)}`;
}

export async function uploadCardImage(userId: string, picked: PickedImage): Promise<string> {
  const path = randomPath(userId, picked.mimeType);
  const res = await fetch(picked.uri);
  const blob = await res.blob();

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: picked.mimeType,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  if (picked.uri.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(picked.uri);
  }

  return data.publicUrl;
}
