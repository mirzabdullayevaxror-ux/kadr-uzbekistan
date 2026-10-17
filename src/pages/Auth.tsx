import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { errMsg, ErrorBox } from '../components/ui';
import { go } from '../lib/router';
import { consumeReturnTo } from '../components/RequireAuth';
import { useAuth } from '../lib/auth';
import { useEffect } from 'react';

// Login / registration with email+password and Google. SMS OTP is wired later (needs provider keys).
export function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!loading && user) go(consumeReturnTo('/dashboard'));
  }, [user, loading]);

  const redirectTo = () => window.location.href.split('#')[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    if (mode === 'register') {
      if (!accepted) { setBusy(false); setError('Davom etish uchun Foydalanish shartlari va Maxfiylik siyosatiga rozilik bering.'); return; }
      if (password.length < 8) { setBusy(false); setError('Parol kamida 8 belgi bo‘lsin.'); return; }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
      setBusy(false);
      if (error) { setError(errMsg(error)); return; }
      if (data.session) go(consumeReturnTo('/dashboard'));
      else setInfo('Emailingizga tasdiqlash havolasi yuborildi. Tasdiqlagach kiring.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) setError(errMsg(error));
      else go(consumeReturnTo('/dashboard'));
    }
  };

  const google = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    if (error) setError(errMsg(error));
  };

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1>{mode === 'login' ? 'Kirish' : 'Ro‘yxatdan o‘tish'}</h1>
      <p className="muted">{mode === 'login' ? 'Kabinetga kirish uchun ma’lumotlaringizni kiriting.' : 'Akkaunt yarating, so‘ng rolingizni tanlaysiz.'}</p>

      <div className="card">
        <button className="btn" style={{ width: '100%' }} onClick={google}>Google bilan davom etish</button>
        <div className="row" style={{ margin: '14px 0' }}><hr style={{ flex: 1, border: 0, borderTop: '1px solid var(--border)' }} /><span className="small">yoki email</span><hr style={{ flex: 1, border: 0, borderTop: '1px solid var(--border)' }} /></div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw">Parol</label>
            <input id="pw" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {mode === 'register' && (
            <label className="row small" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>
                <a href="#/legal/terms">Foydalanish shartlari</a> va <a href="#/legal/privacy">Maxfiylik siyosati</a> bilan tanishdim va roziman.
              </span>
            </label>
          )}
          <ErrorBox error={error} />
          {info && <div className="notice ok" role="status">{info}</div>}
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Kuting…' : mode === 'login' ? 'Kirish' : 'Ro‘yxatdan o‘tish'}
          </button>
        </form>
      </div>

      <p className="small" style={{ marginTop: 16, textAlign: 'center' }}>
        {mode === 'login' ? <>Akkauntingiz yo‘qmi? <a href="#/register">Ro‘yxatdan o‘ting</a></> : <>Akkauntingiz bormi? <a href="#/login">Kiring</a></>}
      </p>

      {mode === 'register' && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Rolingizni keyin tanlaysiz</h3>
          <ul className="small" style={{ paddingLeft: 18, color: 'var(--muted)' }}>
            <li><b>Mijoz</b> — tasdiqsiz, darhol faol</li>
            <li><b>Mutaxassis, Kompaniya, Sotuvchi, O‘quv markazi</b> — admin tasdig‘i kerak</li>
          </ul>
        </div>
      )}
    </div>
  );
}
