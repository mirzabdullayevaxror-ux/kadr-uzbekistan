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
  { title: 'Videografiya', text: 'Kamera, yorug‘lik va kadr — loyihaning ko‘zi.', img: 'images/camera-forest.jpg', alt: 'Kamera bilan suratga olish' },
  { title: 'Fotografiya', text: 'Kompozitsiya, yorug‘lik va lahza.', img: 'images/photographer.jpg', alt: 'Fotograf kamera bilan' },
  { title: 'Montaj', text: 'Hikoyani to‘g‘ri ritm bilan yig‘ish.', img: 'images/editing-dark.jpg', alt: 'Video montaj dasturi ekrani' }
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
              <img src={x.img} alt={x.alt} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />
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
