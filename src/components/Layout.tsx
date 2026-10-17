import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { go } from '../lib/router';

const PUBLIC_LINKS: [string, string][] = [
  ['/talent', 'Mutaxassislar'], ['/company', 'Kompaniyalar'], ['/center', 'O‘quv markazlari'],
  ['/vacancies', 'Vakansiyalar'], ['/casting', 'Casting']
];

export function Layout({ path, children }: { path: string; children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const active = (p: string) => (path === p || path.startsWith(p + '/') ? 'active' : '');

  return (
    <>
      <header className="header">
        <div className="container">
          <a href="#/" className="brand" aria-label="KADR bosh sahifa">KADR<span>.</span></a>
          <nav className="nav" aria-label="Asosiy navigatsiya">
            {PUBLIC_LINKS.map(([p, label]) => (
              <a key={p} href={`#${p}`} className={active(p)}>{label}</a>
            ))}
          </nav>
          <div className="spacer" />
          {user ? (
            <div className="row">
              <a className="btn sm ghost" href="#/dashboard">Kabinet</a>
              {isAdmin && <a className="btn sm ghost" href="#/admin">Admin</a>}
              <button className="btn sm" onClick={async () => { await signOut(); go('/'); }}>Chiqish</button>
            </div>
          ) : (
            <div className="row">
              <a className="btn sm ghost" href="#/login">Kirish</a>
              <a className="btn sm primary" href="#/register">Ro‘yxatdan o‘tish</a>
            </div>
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <div className="container">
          <nav aria-label="Platforma">
            {PUBLIC_LINKS.map(([p, label]) => <a key={p} href={`#${p}`}>{label}</a>)}
          </nav>
          <nav aria-label="Yordam">
            <a href="#/support">Yordam / Support</a>
            <a href="#/legal/terms">Foydalanish shartlari</a>
            <a href="#/legal/privacy">Maxfiylik siyosati</a>
          </nav>
          <p className="small">© {new Date().getFullYear()} KADR O‘zbekiston. Katta loyihalar katta odamlar bilan boshlanadi!</p>
        </div>
      </footer>

      {user && (
        <nav className="bottom-nav" aria-label="Mobil navigatsiya">
          <a href="#/talent" className={active('/talent')}>Talent</a>
          <a href="#/vacancies" className={active('/vacancies')}>Ish</a>
          <a href="#/inbox" className={active('/inbox')}>Xabarlar</a>
          <a href="#/dashboard" className={active('/dashboard')}>Kabinet</a>
        </nav>
      )}
    </>
  );
}

export { supabase };
