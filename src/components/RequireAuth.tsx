import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useHashRoute, go } from '../lib/router';

// Protected routes: remember where the user wanted to go (returnTo) and send them to login.
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const [path] = useHashRoute();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      try { sessionStorage.setItem('kadr:returnTo', path); } catch { /* storage may be blocked */ }
      go('/login');
    }
  }, [user, loading, path]);

  if (loading) return null;
  if (!user) return null;
  if (admin && !isAdmin) {
    return (
      <div className="notice error" role="alert">
        Bu sahifa faqat admin uchun. Ruxsatingiz yo‘q.
      </div>
    );
  }
  return <>{children}</>;
}

export function consumeReturnTo(fallback = '/dashboard'): string {
  try {
    const v = sessionStorage.getItem('kadr:returnTo');
    sessionStorage.removeItem('kadr:returnTo');
    return v || fallback;
  } catch {
    return fallback;
  }
}
