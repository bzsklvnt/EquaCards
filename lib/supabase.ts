import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let _supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
    if (!_supabase) {
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error(
                'Supabase configuration missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment variables.'
            );
        }
        _supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
    return _supabase;
};

// Export a proxy that initializes the client on first access
export const supabase = new Proxy({} as SupabaseClient, {
    get(_, prop) {
        const client = getSupabase();
        const value = (client as any)[prop];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    },
});

export type FlashcardData = {
    id?: string;
    category: string;
    front_text: string;
    answer: string;
    image_url?: string;
    created_at?: string;
};
