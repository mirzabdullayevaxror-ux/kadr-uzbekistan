import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { KIND_LABEL, STATUS_LABEL } from '../lib/constants';
import { Empty, ErrorBox, Loading, StatusBadge, errMsg, fmtDate } from '../components/ui';
import { StaffPanel, Tickets } from './Admin';

// Control area for admins and rahbar. Every action is also enforced in the database.
type Section = 'dash' | 'users' | 'accounts' | 'vacancies' | 'applications' | 'support' | 'audit' | 'broadcast' | 'staff';
const SECTIONS: { id: Section; label: string; ownerOnly?: boolean }[] = [
  { id: 'dash', label: 'Bosh sahifa' },
  { id: 'users', label: 'Foydalanuvchilar' },
  { id: 'accounts', label: 'Akkauntlar' },
  { id: 'vacancies', label: 'E’lonlar' },
  { id: 'applications', label: 'Arizalar' },
  { id: 'support', label: 'Support' },
  { id: 'broadcast', label: 'Xabar yuborish' },
  { id: 'audit', label: 'Audit log' },
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
          {section === 'support' && <Tickets />}
          {section === 'broadcast' && <Broadcast />}
          {section === 'audit' && <AuditLog />}
          {section === 'staff' && isOwner && <StaffPanel />}
        </div>
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */

function downloadCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function CsvButton(props: { onClick: () => void; disabled?: boolean }) {
  return <button className="btn sm" disabled={props.disabled} onClick={props.onClick}>CSV yuklab olish</button>;
}

/* ---------- Dashboard ---------- */

type Daily = { day: string; count: number };

function SignupChart({ data }: { data: Daily[] }) {
  const W = 560, H = 170, pad = 26;
  const max = Math.max(1, ...data.map((d) => d.count));
  const bw = (W - pad * 2) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Oxirgi 14 kunda ro‘yxatdan o‘tganlar" style={{ width: '100%', height: 'auto' }}>
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#333" />
      {data.map((d, i) => {
        const h = (d.count / max) * (H - pad * 2 - 10);
        const x = pad + i * bw + bw * 0.18;
        return (
          <g key={d.day}>
            <rect x={x} y={H - pad - h} width={bw * 0.64} height={Math.max(h, d.count ? 2 : 0)} rx={3} fill="#f5a524">
              <title>{`${d.day}: ${d.count} ta`}</title>
            </rect>
            {d.count > 0 && <text x={x + bw * 0.32} y={H - pad - h - 4} fontSize="11" fill="#ddd" textAnchor="middle">{d.count}</text>}
            {i % 2 === 0 && <text x={x + bw * 0.32} y={H - 8} fontSize="10" fill="#888" textAnchor="middle">{d.day.slice(8)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

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
    ['Bloklangan', s.banned],
    ['Akkauntlar', s.accounts_total],
    ['Tekshiruvda akkaunt', s.accounts_pending],
    ['E’lonlar', s.vacancies_total],
    ['Tekshiruvda e’lon', s.vacancies_pending],
    ['Arizalar', s.applications_total],
    ['Ochiq support', s.tickets_open]
  ];
  const byKind = (s.accounts_by_kind ?? {}) as Record<string, number>;
  const daily = (s.signups_daily ?? []) as Daily[];

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
        <h3 style={{ marginTop: 0 }}>Oxirgi 14 kunda ro‘yxatdan o‘tganlar</h3>
        {daily.length === 0 ? <Empty>Ma’lumot yo‘q</Empty> : <SignupChart data={daily} />}
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
type BanRow = { user_id: string; reason: string; created_at: string };

function Users() {
  const { isOwner, user } = useAuth();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [bans, setBans] = useState<Record<string, BanRow>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (search: string) => {
    setError(null);
    const [u, b] = await Promise.all([
      supabase.rpc('admin_list_users', { p_search: search.trim() || null }),
      supabase.rpc('admin_banned_users')
    ]);
    if (u.error) { setError(errMsg(u.error)); return; }
    if (b.error) { setError(errMsg(b.error)); return; }
    setRows((u.data ?? []) as UserRow[]);
    const map: Record<string, BanRow> = {};
    for (const x of (b.data ?? []) as BanRow[]) map[x.user_id] = x;
    setBans(map);
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

  const toggleBan = async (r: UserRow) => {
    const banned = !!bans[r.user_id];
    let reason: string | null = null;
    if (!banned) {
      reason = window.prompt(`${r.email} ni bloklash sababi (majburiy):`);
      if (!reason || !reason.trim()) return;
    } else if (!window.confirm(`${r.email} blokdan chiqarilsinmi?`)) return;
    setBusy(r.user_id); setError(null);
    const { error } = await supabase.rpc('admin_set_ban', { p_user: r.user_id, p_ban: !banned, p_reason: reason });
    setBusy(null);
    if (error) { setError(errMsg(error)); return; }
    void load(q);
  };

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Email bo‘yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load(q); }} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn" onClick={() => void load(q)}>Qidirish</button>
        <CsvButton disabled={!rows?.length} onClick={() => downloadCsv('foydalanuvchilar',
          ['Email', 'Rollar', 'Akkauntlar', 'Ro‘yxatdan o‘tgan', 'Oxirgi kirish', 'Bloklangan'],
          (rows ?? []).map((r) => [r.email, r.roles.join(' '), r.accounts_count, r.created_at, r.last_sign_in_at, bans[r.user_id] ? 'ha' : 'yo‘q']))} />
      </div>
      {error && <ErrorBox error={error} />}
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty>Foydalanuvchi topilmadi</Empty> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Email</th><th>Rol / holat</th><th>Akkauntlar</th><th>Ro‘yxatdan</th><th>Oxirgi kirish</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const isA = r.roles.includes('admin');
                const isR = r.roles.includes('owner');
                const isBanned = !!bans[r.user_id];
                const isMe = r.user_id === user?.id;
                const canBan = !isR && !isMe && (!isA || isOwner);
                return (
                  <tr key={r.user_id}>
                    <td>{r.email}{isMe && <span className="small"> (siz)</span>}</td>
                    <td>
                      {isR ? 'Rahbar' : isA ? 'Admin' : '—'}
                      {isBanned && <span style={{ color: '#ffb3b3' }}> · bloklangan</span>}
                      {isBanned && <div className="small">Sabab: {bans[r.user_id].reason}</div>}
                    </td>
                    <td>{r.accounts_count}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>{fmtDate(r.last_sign_in_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {!isR && (
                          <button className="btn sm" disabled={!isOwner || busy === r.user_id} onClick={() => void toggleAdmin(r)}
                            title={isOwner ? '' : 'Faqat rahbar admin rolini boshqaradi'}>
                            {isA ? 'Adminlikni olish' : 'Admin qilish'}
                          </button>
                        )}
                        {canBan && (
                          <button className="btn sm" disabled={busy === r.user_id} onClick={() => void toggleBan(r)}
                            style={isBanned ? undefined : { color: '#ffb3b3' }}>
                            {isBanned ? 'Blokdan chiqarish' : 'Bloklash'}
                          </button>
                        )}
                      </div>
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

type AccRow = { id: string; username: string; display_name: string; kind: string; status: string; city: string | null; is_verified: boolean; pro_tier: string; pro_until: string | null; created_at: string };

function Accounts() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState<AccRow[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    let query = supabase.from('accounts')
      .select('id,username,display_name,kind,status,city,is_verified,pro_tier,pro_until,created_at')
      .order('created_at', { ascending: false }).limit(300);
    if (status) query = query.eq('status', status);
    if (kind) query = query.eq('kind', kind);
    const s = q.trim().replace(/[%,()]/g, '');
    if (s) query = query.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);
    const { data, error } = await query;
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as unknown as AccRow[]);
  };
  useEffect(() => { void load(); }, [status, kind]);

  if (editing) return <AccountEditor id={editing} onClose={() => { setEditing(null); void load(); }} />;

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Username yoki ism" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load(); }} style={{ flex: 1, minWidth: 180 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Barcha holat</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Barcha turi</option>
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn" onClick={() => void load()}>Qidirish</button>
        <CsvButton disabled={!rows?.length} onClick={() => downloadCsv('akkauntlar',
          ['Username', 'Ism', 'Turi', 'Holat', 'Shahar', 'Tarif', 'Tarif tugashi', 'Tasdiqlangan', 'Yaratilgan'],
          (rows ?? []).map((r) => [r.username, r.display_name, r.kind, r.status, r.city, r.pro_tier, r.pro_until, r.is_verified ? 'ha' : 'yo‘q', r.created_at]))} />
      </div>
      {error && <ErrorBox error={error} />}
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty>Akkaunt topilmadi</Empty> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Ism</th><th>Turi</th><th>Holat</th><th>Shahar</th><th>Tarif</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.display_name} <span className="small">@{r.username}</span></td>
                  <td>{KIND_LABEL[r.kind as keyof typeof KIND_LABEL] ?? r.kind}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.city ?? '—'}</td>
                  <td>{r.pro_tier}{r.pro_until ? <span className="small"> · {fmtDate(r.pro_until)} gacha</span> : null}</td>
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

type AccFull = { id: string; username: string; display_name: string; kind: string; status: string; about: string | null; city: string | null; region_code: string | null; address: string | null; instagram: string | null; website: string | null; is_verified: boolean; pro_tier: string; pro_until: string | null; reject_reason: string | null };

function AccountEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [a, setA] = useState<AccFull | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const load = async () => {
    const { data, error } = await supabase.from('accounts')
      .select('id,username,display_name,kind,status,about,city,region_code,address,instagram,website,is_verified,pro_tier,pro_until,reject_reason')
      .eq('id', id).maybeSingle();
    if (error || !data) { setMsg({ err: error ? errMsg(error) : 'Akkaunt topilmadi' }); return; }
    const row = data as unknown as AccFull;
    setA(row);
    setVerified(row.is_verified);
    setF({
      username: row.username, display_name: row.display_name, about: row.about ?? '', city: row.city ?? '',
      region_code: row.region_code ?? '', address: row.address ?? '', instagram: row.instagram ?? '',
      website: row.website ?? '', pro_tier: row.pro_tier, pro_until: row.pro_until ? row.pro_until.slice(0, 10) : ''
    });
  };
  useEffect(() => { void load(); }, [id]);

  const save = async () => {
    setBusy(true); setMsg({});
    const payload: Record<string, unknown> = { ...f, is_verified: verified };
    if (!f.pro_until) payload.pro_until = '';
    const { error } = await supabase.rpc('admin_update_account', { p_id: id, p: payload });
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

  const field = (key: string, label: string, multiline = false, type = 'text') => (
    <label className="stack" style={{ gap: 4 }}>
      <span className="small">{label}</span>
      {multiline
        ? <textarea rows={3} value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
        : <input type={type} value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} />}
    </label>
  );

  return (
    <div className="stack">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{a.display_name} <span className="small">· {KIND_LABEL[a.kind as keyof typeof KIND_LABEL] ?? a.kind}</span></h2>
        <button className="btn sm" onClick={onClose}>← Ro‘yxatga qaytish</button>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
        {field('pro_until', 'Tarif tugash sanasi', false, 'date')}
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          <span>Tasdiqlangan (verified)</span>
        </label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={busy} onClick={() => void save()}>Saqlash</button>
          <button className="btn" disabled={busy} onClick={() => void remove()} style={{ color: '#ffb3b3' }}>Akkauntni o‘chirish</button>
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
      .order('created_at', { ascending: false }).limit(300);
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as unknown as VacRow[]);
  };
  useEffect(() => { void load(); }, []);

  if (editing) return <VacancyEditor row={editing} onClose={() => { setEditing(null); void load(); }} />;
  if (error) return <ErrorBox error={error} />;
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty>E’lon yo‘q</Empty>;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <CsvButton onClick={() => downloadCsv('elonlar',
          ['Sarlavha', 'Holat', 'Kategoriya', 'Shahar', 'Maosh min', 'Maosh max', 'Yaratilgan'],
          rows.map((r) => [r.title, r.status, r.category, r.city, r.salary_min, r.salary_max, r.created_at]))} />
      </div>
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
          <button className="btn" disabled={busy} onClick={() => void remove()} style={{ color: '#ffb3b3' }}>E’lonni o‘chirish</button>
        </div>
        {msg.ok && <div className="notice ok" role="status">{msg.ok}</div>}
        {msg.err && <div className="notice error" role="alert">{msg.err}</div>}
      </div>
    </div>
  );
}

/* ---------- Applications ---------- */

type AppRow = { id: string; status: string; message: string | null; created_at: string; vacancy_id: string };
const APP_STATUSES: [string, string][] = [['pending', 'Kutilmoqda'], ['shortlisted', 'Saralangan'], ['accepted', 'Qabul qilingan'], ['rejected', 'Rad etilgan']];

function Applications() {
  const [rows, setRows] = useState<AppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('applications').select('id,status,message,created_at,vacancy_id')
      .order('created_at', { ascending: false }).limit(300);
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as unknown as AppRow[]);
  };
  useEffect(() => { void load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setBusy(id); setError(null);
    const { error } = await supabase.rpc('admin_update_application', { p_id: id, p_status: status });
    setBusy(null);
    if (error) { setError(errMsg(error)); return; }
    void load();
  };

  if (error && !rows) return <ErrorBox error={error} />;
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty>Ariza yo‘q</Empty>;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <CsvButton onClick={() => downloadCsv('arizalar',
          ['Sana', 'Holat', 'Xabar', 'E’lon ID'],
          rows.map((r) => [r.created_at, r.status, r.message, r.vacancy_id]))} />
      </div>
      {error && <ErrorBox error={error} />}
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Sana</th><th>Holat</th><th>Xabar</th><th>Amal</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.message ?? '—'}</td>
                <td>
                  <select value={r.status} disabled={busy === r.id} onChange={(e) => void setStatus(r.id, e.target.value)}>
                    {APP_STATUSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Broadcast ---------- */

function Broadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const send = async () => {
    if (!title.trim()) { setMsg({ err: 'Sarlavha kiriting' }); return; }
    if (!window.confirm('Barcha foydalanuvchilarga bildirishnoma yuborilsinmi?')) return;
    setBusy(true); setMsg({});
    const { data, error } = await supabase.rpc('admin_broadcast', { p_title: title.trim(), p_body: body.trim(), p_link: link.trim() || null });
    setBusy(false);
    if (error) { setMsg({ err: errMsg(error) }); return; }
    setMsg({ ok: `${data ?? 0} ta foydalanuvchiga yuborildi` });
    setTitle(''); setBody(''); setLink('');
  };

  return (
    <div className="card stack">
      <h3 style={{ marginTop: 0 }}>Barchaga bildirishnoma</h3>
      <p className="small" style={{ margin: 0 }}>Xabar barcha ro‘yxatdan o‘tgan foydalanuvchilarning bildirishnomalar bo‘limiga tushadi.</p>
      <label className="stack" style={{ gap: 4 }}><span className="small">Sarlavha</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="stack" style={{ gap: 4 }}><span className="small">Matn</span>
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <label className="stack" style={{ gap: 4 }}><span className="small">Havola (ixtiyoriy, masalan #/vacancies)</span>
        <input value={link} onChange={(e) => setLink(e.target.value)} /></label>
      <div><button className="btn primary" disabled={busy} onClick={() => void send()}>Yuborish</button></div>
      {msg.ok && <div className="notice ok" role="status">{msg.ok}</div>}
      {msg.err && <div className="notice error" role="alert">{msg.err}</div>}
    </div>
  );
}

/* ---------- Audit ---------- */

type AuditRow = { created_at: string; actor_email: string | null; action: string; entity: string; entity_id: string; old_status: string | null; new_status: string | null; reason: string | null };

function AuditLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const { data, error } = await supabase.rpc('admin_list_audit', { p_limit: 300 });
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as AuditRow[]);
  };
  useEffect(() => { void load(); }, []);

  if (error) return <ErrorBox error={error} />;
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty>Hali yozuv yo‘q</Empty>;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn sm" onClick={() => void load()}>Yangilash</button>
        <CsvButton onClick={() => downloadCsv('audit',
          ['Sana', 'Kim', 'Amal', 'Obyekt', 'ID', 'Eski', 'Yangi', 'Izoh'],
          rows.map((r) => [r.created_at, r.actor_email, r.action, r.entity, r.entity_id, r.old_status, r.new_status, r.reason]))} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Sana</th><th>Kim</th><th>Amal</th><th>Izoh</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.actor_email ?? '—'}</td>
                <td>{r.action}{r.new_status ? <span className="small"> → {r.new_status}</span> : null}</td>
                <td className="small">{r.reason ?? r.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
