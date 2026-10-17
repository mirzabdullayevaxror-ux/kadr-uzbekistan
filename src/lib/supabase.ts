import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY sozlanmagan');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// Safe column list for public-ish reads of accounts. Private fields
// (birth_date, phone, email, telegram) are NOT granted to the client and
// must never be selected with `*`.
export const ACCOUNT_COLS =
  'id,owner_id,kind,username,display_name,about,avatar_url,cover_url,professions,profile_data,region_code,city,address,lat,lng,instagram,website,status,reject_reason,is_verified,pro_tier,pro_until,created_at,updated_at';
