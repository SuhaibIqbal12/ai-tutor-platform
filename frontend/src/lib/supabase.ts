import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wfahipazyfyzqvhiqrem.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_itDvneLLL8iMRhxHjjSuEQ_sXtw1k0-';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
