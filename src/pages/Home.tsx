import { useEffect, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import type { Account } from '../lib/auth';
import { Avatar, Empty, Loading, errMsg, ErrorBox } from '../components/ui';
import { KIND_PATH } from '../lib/constants';

const ECOSYSTEM = [
  { href: '#/talent', title: 'Mutaxassislar', text: 'Videograf, montajyor, fotograf, Brand Face va 30+ kasb.' },
  { href: '#/company', title: 'Kompaniyalar', text: 'Studio, agency va production jamoalari.' },
  { href: '#/center', title: 'O‘quv markazlari', text: 'Media ta’lim markazlari va natijalari.' },
  { href: '#/vacancies', title: 'Vakansiyalar', text: 'Bepul e’lonlar, admin tekshiruvidan so‘ng.' },
  { href: '#/casting', title: 'Casting', text: 'Rol va loyihalar uchun bepul casting.' },
  { href: '#/shop', title: 'KADR Market', text: 'Texnika sotuvi va arendasi (keyingi reliz).' }
];

const SECTORS = [
  { title: 'Videografiya', text: 'Kamera, yorug‘lik va kadr — loyihaning ko‘zi.', icon: (
    <svg viewBox="0 0 120 80" role="img" aria-label="Kamera"><rect x="10" y="22" width="70" height="42" rx="8" fill="#2a2a2a" stroke="#f5a524" strokeWidth="3"/><path d="M80 36l30-14v40l-30-14z" fill="#f5a524"/><circle cx="45" cy="43" r="12" fill="none" stroke="#f5a524" strokeWidth="3"/></svg>) },
  { title: 'Montaj', text: 'Hikoyani to‘g‘ri ritm bilan yig‘ish.', icon: (
    <svg viewBox="0 0 120 80" role="img" aria-label="Montaj"><rect x="8" y="16" width="104" height="48" rx="6" fill="#1b1b1b" stroke="#333"/><rect x="14" y="22" width="26" height="36" rx="3" fill="#f5a524"/><rect x="46" y="22" width="26" height="36" rx="3" fill="#3a3a3a"/><rect x="78" y="22" width="26" height="36" rx="3" fill="#3a3a3a"/><path d="M8 72h104" stroke="#f5a524" strokeWidth="3"/></svg>) },
  { title: 'Ovoz va studiya', text: 'Mikrofon, audio va podkast sifati.', icon: (
    <svg viewBox="0 0 120 80" role="img" aria-label="Mikrofon"><rect x="48" y="10" width="24" height="40" rx="12" fill="#f5a524"/><path d="M34 40a26 26 0 0 0 52 0" fill="none" stroke="#888" strokeWidth="3"/><path d="M60 66v8M46 74h28" stroke="#888" strokeWidth="3"/></svg>) }
];

export function Home() {
  const [talents, setTalents] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('accounts').select(ACCOUNT_COLS)
      .eq('status', 'approved').eq('kind', 'mutaxassis')
      .order('created_at', { ascending: false }).limit(6)
      .then(({ data, error }) => {
        if (error) setError(errMsg(error));
        else setTalents((data ?? []) as unknown as Account[]);
      });
  }, []);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <p className="small" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '.12em' }}>MEDIA OLAMI. BIR PLATFORMADA.</p>
        <h1 id="hero-title">Katta loyihalar katta odamlar bilan boshlanadi!</h1>
        <p className="lead">
          O‘zbekiston bo‘ylab media mutaxassislar, mijozlar, kompaniyalar, o‘quv markazlari va texnika
          sotuvchilarini bitta ekotizimga birlashtiradi: katalog, vakansiya, casting, taklif va chat.
        </p>
        <div className="row" style={{ marginTop: 22 }}>
          <a className="btn primary" href="#/talent">Barcha mutaxassislar</a>
          <a className="btn" href="#/register">Ro‘yxatdan o‘tish</a>
        </div>
      </section>

      <section aria-labelledby="about-title" style={{ marginTop: 40 }}>
        <h2 id="about-title">Biz haqimizda</h2>
        <p className="lead" style={{ marginTop: 0 }}>
          KADR O‘zbekiston — media sohasi uchun yagona platforma. Bu yerda mutaxassislar o‘z portfolio va
          kasblarini ko‘rsatadi, mijozlar va kompaniyalar kerakli jamoani topadi, o‘quv markazlari esa o‘z
          kurslarini e’lon qiladi.
        </p>
        <div className="grid" style={{ marginTop: 16 }}>
          {SECTORS.map((x) => (
            <div key={x.title} className="card">
              <div style={{ background: '#111', borderRadius: 10, padding: 10, marginBottom: 12 }}>{x.icon}</div>
              <h3 style={{ margin: '0 0 6px' }}>{x.title}</h3>
              <p className="small" style={{ margin: 0 }}>{x.text}</p>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <p className="small" style={{ margin: 0, color: 'var(--accent)', fontWeight: 700, letterSpacing: '.1em' }}>DASTURCHI</p>
          <h3 style={{ margin: '6px 0 4px', fontSize: 22 }}>Nurislom Narzullayev</h3>
          <p className="small" style={{ margin: '0 0 14px' }}>Platformani ishlab chiqish va qo‘llab-quvvatlash.</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <a className="btn" href="https://t.me/nurislomdev" target="_blank" rel="noopener noreferrer">Telegram: @nurislomdev</a>
            <a className="btn" href="https://instagram.com/nurislomdev" target="_blank" rel="noopener noreferrer">Instagram: @nurislomdev</a>
          </div>
        </div>
      </section>

      <section aria-labelledby="eco-title" style={{ marginTop: 40 }}>
        <h2 id="eco-title">Ekotizim</h2>
        <div className="grid">
          {ECOSYSTEM.map((e) => (
            <a key={e.href} href={e.href} className="card hover">
              <h3>{e.title}</h3>
              <p className="small">{e.text}</p>
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="talent-title" style={{ marginTop: 40 }}>
        <div className="row between">
          <h2 id="talent-title">Yangi mutaxassislar</h2>
          <a href="#/talent" className="small">Barchasi →</a>
        </div>
        {error && <ErrorBox error={error} />}
        {talents === null && !error && <Loading />}
        {talents && talents.length === 0 && <Empty>Hozircha tasdiqlangan mutaxassis yo‘q.</Empty>}
        {talents && talents.length > 0 && (
          <div className="grid">
            {talents.map((t) => (
              <a key={t.id} href={`#/${KIND_PATH[t.kind]}/${t.username}`} className="card hover row">
                <Avatar name={t.display_name} src={t.avatar_url} />
                <div>
                  <h3 style={{ margin: 0 }}>{t.display_name}</h3>
                  <p className="small" style={{ margin: 0 }}>{t.professions.slice(0, 3).join(' · ') || 'Mutaxassis'}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
