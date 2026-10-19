import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { KIND_LABEL } from '../lib/constants';
import { Empty, ErrorBox, Loading, StatusBadge, errMsg, fmtDate } from '../components/ui';
import { StaffPanel } from './Admin';

// Separate control area for admins (and rahbar). Everything here is also enforced in the database.
type Section = 'dash' | 'users' | 'accounts' | 'vacancies' | 'applications' | 'staff';
const SECTIONS: { id: Section; label: string; ownerOnly?: boolean }[] = [
  { id: 'dash', label: 'Bosh sahifa' },
  { id: 'users', label: 'Foydalanuvchilar' },
  { id: 'accounts', label: 'Akkauntlar' },
  { id: 'vacancies', label: 'E’lonlar' },
  { id: 'applications', label: 'Arizalar' },
  { id: 'staff', label: 'Adminlar', ownerOnly: true }
];

export function Control() {
  const { isOwner } = useAuth();
  const [section, setSection] = useState<Section>('dash');
  const items = SECTIONS.filter((s) => !s.ownerOnly || isOwner);

  return (
    <section aria-labelledby="ctl-title">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 id="ctl-title" style={{ margin: 0 }}>Boshqaruv paneli</h1>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="small">{isOwner ? 'Rahbar — to‘liq huquq' : 'Admin'}</span>
          <a className="btn sm" href="#/admin">Moderatsiya navbati</a>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
        <nav aria-label="Boshqaruv bo‘limlari" style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((s) => (
            <button key={s.id} className={`btn sm ${section === s.id ? 'primary' : ''}`}
              aria-current={section === s.id ? 'page' : undefined}
              style={{ textAlign: 'left' }} onClick={() => setSection(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          {section === 'dash' && <Dashboard />}
          {section === 'users' && <Users />}
          {section === 'accounts' && <Accounts />}
          {section === 'vacancies' && <Vacancies />}
          {section === 'applications' && <Applications />}
          {section === 'staff' && isOwner && <StaffPanel />}
        </div>
      </div>
    </section>
  );
}

/* ---------- Dashboard ---------- */

function Dashboard() {
  const [s, setS] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error }) => {
      if (error) setError(errMsg(error));
      else setS((data ?? {}) as Record<string, unknown>);
    });
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!s) return <Loading />;

  const cards: [string, unknown][] = [
    ['Foydalanuvchilar', s.users],
    ['Yangi (7 kun)', s.signups_7d],
    ['Akkauntlar', s.accounts_total],
    ['Tekshiruvda akkaunt', s.accounts_pending],
    ['E’lonlar', s.vacancies_total],
    ['Tekshiruvda e’lon', s.vacancies_pending],
    ['Arizalar', s.applications_total],
    ['Ochiq support', s.tickets_open]
  ];
  const byKind = (s.accounts_by_kind ?? {}) as Record<string, number>;

  return (
    <div className="stack">
      <div className="grid">
        {cards.map(([label, v]) => (
          <div key={label} className="card">
            <p className="small" style={{ margin: 0 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 0' }}>{String(v ?? 0)}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Akkauntlar turi bo‘yicha</h3>
        {Object.keys(byKind).length === 0 ? <Empty>Hali akkaunt yo‘q</Empty> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {Object.entries(byKind).map(([k, c]) => (
              <li key={k}>{KIND_LABEL[k as keyof typeof KIND_LABEL] ?? k}: <strong>{c}</strong></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- Users ---------- */

type UserRow = { user_id: string; email: string; created_at: string; last_sign_in_at: string | null; roles: string[]; accounts_count: number };

function Users() {
  const { isOwner } = useAuth();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (search: string) => {
    setError(null);
    const { data, error } = await supabase.rpc('admin_list_users', { p_search: search.trim() || null });
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as UserRow[]);
  };
  useEffect(() => { void load(''); }, []);

  const toggleAdmin = async (r: UserRow) => {
    const isA = r.roles.includes('admin');
    if (!window.confirm(`${r.email} uchun admin roli ${isA ? 'olib tashlansinmi' : 'berilsinmi'}?`)) return;
    setBusy(r.user_id); setError(null);
    const { error } = await supabase.rpc('set_user_role', { p_user: r.user_id, p_role: 'admin', p_grant: !isA });
    setBusy(null);
    if (error) { setError(errMsg(error)); return; }
    void load(q);
  };

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8 }}>
        <input placeholder="Email bo‘yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load(q); }} style={{ flex: 1 }} />
        <button className="btn" onClick={() => void load(q)}>Qidirish</button>
      </div>
      {error && <ErrorBox error={error} />}
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty>Foydalanuvchi topilmadi</Empty> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Email</th><th>Rollar</th><th>Akkauntlar</th><th>Ro‘yxatdan o‘tgan</th><th>Oxirgi kirish</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const isA = r.roles.includes('admin');
                const isR = r.roles.includes('owner');
                return (
                  <tr key={r.user_id}>
                    <td>{r.email}</td>
                    <td>{isR ? 'Rahbar' : isA ? 'Admin' : '—'}</td>
                    <td>{r.accounts_count}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>{fmtDate(r.last_sign_in_at)}</td>
                    <td>
                      {!isR && (
                        <button className="btn sm" disabled={!isOwner || busy === r.user_id} onClick={() => void toggleAdmin(r)}
                          title={isOwner ? '' : 'Faqat rahbar admin rolini boshqaradi'}>
                          {isA ? 'Adminlikni olish' : 'Admin qilish'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Accounts ---------- */

type AccRow = { id: string; username: string; display_name: string; kind: string; status: string; city: string | null; is_verified: boolean; pro_tier: string; created_at: string };

function Accounts() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AccRow[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (search: string) => {
    setError(null);
    let query = supabase.from('accounts')
      .select('id,username,display_name,kind,status,city,is_verified,pro_tier,created_at')
      .order('created_at', { ascending: false }).limit(200);
    const s = search.trim().replace(/[%,()]/g, '');
    if (s) query = query.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);
    const { data, error } = await query;
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as unknown as AccRow[]);
  };
  useEffect(() => { void load(''); }, []);

  if (editing) return <AccountEditor id={editing} onClose={() => { setEditing(null); void load(q); }} />;

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8 }}>
        <input placeholder="Username yoki ism bo‘yicha" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load(q); }} style={{ flex: 1 }} />
        <button className="btn" onClick={() => void load(q)}>Qidirish</button>
      </div>
      {error && <ErrorBox error={error} />}
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty>Akkaunt topilmadi</Empty> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Ism</th><th>Turi</th><th>Holat</th><th>Shahar</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.display_name} <span className="small">@{r.username}</span></td>
                  <td>{KIND_LABEL[r.kind as keyof typeof KIND_LABEL] ?? r.kind}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.city ?? '—'}</td>
                  <td><button className="btn sm" onClick={() => setEditing(r.id)}>Tahrirlash</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type AccFull = { id: string; username: string; display_name: string; kind: string; status: string; about: string | null; city: string | null; region_code: string | null; address: string | null; instagram: string | null; website: string | null; is_verified: boolean; pro_tier: string; reject_reason: string | null };

function AccountEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [a, setA] = useState<AccFull | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const load = async () => {
    const { data, error } = await supabase.from('accounts')
      .select('id,username,display_name,kind,status,about,city,region_code,address,instagram,website,is_verified,pro_tier,reject_reason')
      .eq('id', id).maybeSingle();
    if (error || !data) { setMsg({ err: error ? errMsg(error) : 'Akkaunt topilmadi' }); return; }
    const row = data as unknown as AccFull;
    setA(row);
    setVerified(row.is_verified);
    setF({
      username: row.username, display_name: row.display_name, about: row.about ?? '', city: row.city ?? '',
      region_code: row.region_code ?? '', address: row.address ?? '', instagram: row.instagram ?? '',
      website: row.website ?? '', pro_tier: row.pro_tier
    });
  };
  useEffect(() => { void load(); }, [id]);

  const save = async () => {
    setBusy(true); setMsg({});
    const { error } = await supabase.rpc('admin_update_account', { p_id: id, p: { ...f, is_verified: verified } });
    setBusy(false);
    if (error) { setMsg({ err: errMsg(error) }); return; }
    setMsg({ ok: 'Saqlandi' });
    void load();
  };

  const review = async (status: 'approved' | 'rejected' | 'needs_info') => {
    let reason: string | null = null;
    if (status !== 'approved') {
      reason = window.prompt('Sabab (majburiy):');
      if (!reason || !reason.trim()) return;
    }
    setBusy(true); setMsg({});
    const { error } = await supabase.rpc('admin_review_account', { p_account: id, p_status: status, p_reason: reason });
    setBusy(false);
    if (error) { setMsg({ err: errMsg(error) }); return; }
    setMsg({ ok: 'Holat yangilandi' });
    void load();
  };

  const remove = async () => {
    if (!window.confirm('Akkauntni butunlay o‘chirish? Bu qaytarib bo‘lmaydi.')) return;
    setBusy(true);
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    setBusy(false);
    if (error) { setMsg({ err: errMsg(error) }); return; }
    onClose();
  };

  if (msg.err && !a) return <ErrorBox error={msg.err} />;
  if (!a) return <Loading />;

  const field = (key: string, label: string, multiline = false) => (
    <label className="stack" style={{ gap: 4 }}>
      <span className="small">{label}</span>
      {multiline
        ? <textarea rows={3} value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
        : <input value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} />}
    </label>
  );

  return (
    <div className="stack">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{a.display_name} <span className="small">· {KIND_LABEL[a.kind as keyof typeof KIND_LABEL] ?? a.kind}</span></h2>
        <button className="btn sm" onClick={onClose}>← Ro‘yxatga qaytish</button>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <span className="small">Holat:</span> <StatusBadge status={a.status} />
        {a.reject_reason && <span className="small">Sabab: {a.reject_reason}</span>}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn sm primary" disabled={busy} onClick={() => void review('approved')}>Tasdiqlash</button>
        <button className="btn sm" disabled={busy} onClick={() => void review('needs_info')}>Ma’lumot so‘rash</button>
        <button className="btn sm" disabled={busy} onClick={() => void review('rejected')}>Rad etish</button>
      </div>

      <div className="card stack">
        {field('display_name', 'Ism / nom')}
        {field('username', 'Username')}
        {field('about', 'Tavsif', true)}
        {field('city', 'Shahar')}
        {field('region_code', 'Viloyat kodi')}
        {field('address', 'Manzil')}
        {field('instagram', 'Instagram')}
        {field('website', 'Veb-sayt')}
        {field('pro_tier', 'Tarif (FREE / PRO / TOP / VIP)')}
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          <span>Tasdiqlangan (verified)</span>
        </label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={busy} onClick={() => void save()}>Saqlash</button>
          <button className="btn" disabled={busy} onClick={() => void remove()} style={{ color: '#ffb3b3' }}>O‘chirish</button>
        </div>
        {msg.ok && <div className="notice ok" role="status">{msg.ok}</div>}
        {msg.err && <div className="notice error" role="alert">{msg.err}</div>}
      </div>
    </div>
  );
}

/* ---------- Vacancies ---------- */

type VacRow = { id: string; title: string; status: string; category: string; city: string | null; salary_min: number | null; salary_max: number | null; description: string | null; created_at: string };

function Vacancies() {
  const [rows, setRows] = useState<VacRow[] | null>(null);
  const [editing, setEditing] = useState<VacRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('vacancies')
      .select('id,title,status,category,city,salary_min,salary_max,description,created_at')
      .order('created_at', { ascending: false }).limit(200);
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as unknown as VacRow[]);
  };
  useEffect(() => { void load(); }, []);

  if (editing) return <VacancyEditor row={editing} onClose={() => { setEditing(null); void load(); }} />;
  if (error) return <ErrorBox error={error} />;
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty>E’lon yo‘q</Empty>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead><tr><th>Sarlavha</th><th>Holat</th><th>Kategoriya</th><th>Shahar</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.category}</td>
              <td>{r.city ?? '—'}</td>
              <td><button className="btn sm" onClick={() => setEditing(r)}>Tahrirlash</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VacancyEditor({ row, onClose }: { row: VacRow; onClose: () => void }) {
  const [f, setF] = useState({
    title: row.title, category: row.category, city: row.city ?? '', description: row.description ?? '',
    salary_min: row.salary_min?.toString() ?? '', salary_max: row.salary_max?.toString() ?? ''
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const save = async () => {
    setBusy(true); setMsg({});
    const { error } = await supabase.rpc('admin_update_vacancy', { p_id: row.id, p: f });
    setBusy(false);
    setMsg(error ? { err: errMsg(error) } : { ok: 'Saqlandi' });
  };

  const review = async (status: 'approved' | 'rejected') => {
    let reason: string | null = null;
    if (status === 'rejected') {
      reason = window.prompt('Sabab (majburiy):');
      if (!reason || !reason.trim()) return;
    }
    setBusy(true); setMsg({});
    const { error } = await supabase.rpc('admin_review_vacancy', { p_vacancy: row.id, p_status: status, p_reason: reason });
    setBusy(false);
    setMsg(error ? { err: errMsg(error) } : { ok: 'Holat yangilandi' });
  };

  const remove = async () => {
    if (!window.confirm('E’lonni butunlay o‘chirish?')) return;
    setBusy(true);
    const { error } = await supabase.from('vacancies').delete().eq('id', row.id);
    setBusy(false);
    if (error) { setMsg({ err: errMsg(error) }); return; }
    onClose();
  };

  return (
    <div className="stack">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{row.title}</h2>
        <button className="btn sm" onClick={onClose}>← Ro‘yxatga qaytish</button>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="small">Holat:</span> <StatusBadge status={row.status} />
        <button className="btn sm primary" disabled={busy} onClick={() => void review('approved')}>Tasdiqlash</button>
        <button className="btn sm" disabled={busy} onClick={() => void review('rejected')}>Rad etish</button>
      </div>
      <div className="card stack">
        <label className="stack" style={{ gap: 4 }}><span className="small">Sarlavha</span>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="stack" style={{ gap: 4 }}><span className="small">Kategoriya</span>
          <input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></label>
        <label className="stack" style={{ gap: 4 }}><span className="small">Shahar</span>
          <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        <label className="stack" style={{ gap: 4 }}><span className="small">Tavsif</span>
          <textarea rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label className="stack" style={{ gap: 4, flex: 1 }}><span className="small">Maosh (min)</span>
            <input inputMode="numeric" value={f.salary_min} onChange={(e) => setF({ ...f, salary_min: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="stack" style={{ gap: 4, flex: 1 }}><span className="small">Maosh (max)</span>
            <input inputMode="numeric" value={f.salary_max} onChange={(e) => setF({ ...f, salary_max: e.target.value.replace(/\D/g, '') })} /></label>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={busy} onClick={() => void save()}>Saqlash</button>
          <button className="btn" disabled={busy} onClick={() => void remove()} style={{ color: '#ffb3b3' }}>O‘chirish</button>
        </div>
        {msg.ok && <div className="notice ok" role="status">{msg.ok}</div>}
        {msg.err && <div className="notice error" role="alert">{msg.err}</div>}
      </div>
    </div>
  );
}

/* ---------- Applications (read-only overview) ---------- */

type AppRow = { id: string; status: string; message: string | null; created_at: string; vacancy_id: string };

function Applications() {
  const [rows, setRows] = useState<AppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('applications').select('id,status,message,created_at,vacancy_id')
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => {
        if (error) setError(errMsg(error));
        else setRows((data ?? []) as unknown as AppRow[]);
      });
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty>Ariza yo‘q</Empty>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead><tr><th>Sana</th><th>Holat</th><th>Xabar</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{fmtDate(r.created_at)}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.message ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
