import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, ACCOUNT_COLS } from './supabase';
import type { AccountKind, AccountStatus } from './constants';

export interface Account {
  id: string;
  owner_id: string;
  kind: AccountKind;
  username: string;
  display_name: string;
  about: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  professions: string[];
  profile_data: Record<string, unknown>;
  region_code: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  instagram: string | null;
  website: string | null;
  status: AccountStatus;
  reject_reason: string | null;
  is_verified: boolean;
  pro_tier: string;
  pro_until: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  accounts: Account[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const load = async (s: Session | null) => {
    if (!s) {
      setIsAdmin(false);
      setAccounts([]);
      return;
    }
    const [roles, accs] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', s.user.id),
      supabase.from('accounts').select(ACCOUNT_COLS).eq('owner_id', s.user.id).order('created_at')
    ]);
    setIsAdmin((roles.data ?? []).some((r) => r.role === 'admin'));
    setAccounts((accs.data ?? []) as unknown as Account[]);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await load(data.session);
  };

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await load(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await load(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ loading, session, user: session?.user ?? null, isAdmin, accounts, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return v;
}
