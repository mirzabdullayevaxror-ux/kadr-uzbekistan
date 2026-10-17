import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface Region { code: string; name_uz: string; sort: number }

let cache: Region[] | null = null;

// Shared region → city taxonomy from the database (single source of truth).
export function useRegions(): Region[] {
  const [regions, setRegions] = useState<Region[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    supabase.from('regions').select('code,name_uz,sort').order('sort').then(({ data }) => {
      cache = (data ?? []) as Region[];
      setRegions(cache);
    });
  }, []);
  return regions;
}
