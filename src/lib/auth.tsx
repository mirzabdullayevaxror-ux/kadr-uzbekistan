import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
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
  /** Session check only. The site renders as soon as this is false. */
  loading: boolean;
  /** Account data for the signed-in user has finished loading (success or error). */
  accountsReady: boolean;
  loadError: string | null;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isOwner: boolean;
  accounts: Account[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const TIMEOUT_MS = 10000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error('Serverga ulanish vaqti tugadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.')),
      ms
    );
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [accountsReady, setAccountsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setIsAdmin(false);
      setIsOwner(false);
      setAccounts([]);
      setLoadError(null);
      setAccountsReady(true);
      return;
    }
    setAccountsReady(false);
    try {
      const [roles, accs] = await withTimeout(
        Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', s.user.id),
          supabase.from('accounts').select(ACCOUNT_COLS).eq('owner_id', s.user.id).order('created_at')
        ]),
        TIMEOUT_MS
      );
      if (roles.error) throw roles.error;
      if (accs.error) throw accs.error;
      const rs = (roles.data ?? []).map((r) => r.role);
      setIsOwner(rs.includes('owner'));
      setIsAdmin(rs.includes('admin') || rs.includes('owner'));
      setAccounts((accs.data ?? []) as unknown as Account[]);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Ma’lumotni yuklashda xato yuz berdi');
    } finally {
      setAccountsReady(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    setAccountsReady(false);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await load(data.session);
  }, [load]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
      void load(data.session);
    }).catch(() => {
      if (!alive) return;
      setLoading(false);
      setAccountsReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      void load(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{
      loading, accountsReady, loadError, session, user: session?.user ?? null,
      isAdmin, isOwner, accounts, refresh, signOut
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return v;
}
