import { useEffect, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import type { Account } from '../lib/auth';
import { KIND_LABEL, STATUS_LABEL, TICKET_CATEGORIES } from '../lib/constants';
import { Empty, ErrorBox, Loading, StatusBadge, errMsg, fmtDate } from '../components/ui';
import { useAuth } from '../lib/auth';

type Tab = 'accounts' | 'vacancies' | 'tickets' | 'audit' | 'staff';
const TABS: [Tab, string][] = [['accounts', 'Akkauntlar'], ['vacancies', 'E’lonlar'], ['tickets', 'Support'], ['audit', 'Audit log'], ['staff', 'Adminlar']];

export function Admin() {
  const [tab, setTab] = useState<Tab>('accounts');
  const { isOwner } = useAuth();
  const tabs = TABS.filter(([k]) => k !== 'staff' || isOwner);
  return (
    <section aria-labelledby="adm-title">
      <h1 id="adm-title">Admin panel</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'accounts' && <AccountQueue />}
      {tab === 'vacancies' && <VacancyQueue />}
      {tab === 'tickets' && <Tickets />}
      {tab === 'audit' && <Audit />}
      {tab === 'staff' && isOwner && <StaffPanel />}
    </section>
  );
}

// Reject / needs_info require a reason (enforced server-side too).
function askReason(): string | null {
  const r = window.prompt('Sabab (majburiy):');
  return r && r.trim() ? r.trim() : null;
}

function AccountQueue() {
  const [items, setItems] = useState<Account[] | null>(null);
  const [contacts, setContacts] = useState<Record<string, Record<string, unknown>>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('accounts').select(ACCOUNT_COLS)
      .in('status', ['submitted', 'in_review', 'needs_info']).order('created_at');
    if (error) { setError(errMsg(error)); return; }
    const rows = (data ?? []) as unknown as Account[];
    setItems(rows);
    if (rows.length) {
      const { data: cs } = await supabase.from('account_contacts').select('account_id,phone,email,telegram,birth_date').in('account_id', rows.map((r) => r.id));
      setContacts(Object.fromEntries((cs ?? []).map((c) => [c.account_id, c])));
    }
  };
  useEffect(() => { load(); }, []);

  const review = async (id: string, status: 'approved' | 'rejected' | 'needs_info' | 'in_review') => {
    let reason: string | null = null;
    if (status === 'rejected' || status === 'needs_info') {
      reason = askReason();
      if (!reason) return;
    }
    const { error } = await supabase.rpc('admin_review_account', { p_account: id, p_status: status, p_reason: reason });
    if (error) setError(errMsg(error)); else load();
  };

  if (error) return <ErrorBox error={error} />;
  if (!items) return <Loading />;
  if (items.length === 0) return <Empty>Tekshiruv navbati bo‘sh.</Empty>;

  return (
    <div className="stack">
      <ErrorBox error={error} />
      {items.map((a) => {
        const c = contacts[a.id] as Record<string, string | null> | undefined;
        return (
          <div key={a.id} className="card stack">
            <div className="row between">
              <div>
                <h3 style={{ margin: 0 }}>{a.display_name} <span className="small muted">@{a.username}</span></h3>
                <p className="small" style={{ margin: 0 }}>{KIND_LABEL[a.kind]} · {a.region_code ?? '—'} · {fmtDate(a.created_at)}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            {a.kind === 'mutaxassis' && <p className="small">Kasblar: {a.professions.join(', ')}</p>}
            {a.about && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.about}</p>}
            <p className="small">Aloqa (faqat admin ko‘radi): {c?.phone ?? '—'} · {c?.email ?? '—'} · {c?.telegram ?? '—'}</p>
            <div className="row">
              <a className="btn sm" href={`#/${a.kind === 'mutaxassis' ? 'talent' : a.kind === 'kompaniya' ? 'company' : a.kind === 'oquv_markazi' ? 'center' : 'shop'}/${a.username}`}>Profilni ochish</a>
              <button className="btn sm primary" onClick={() => review(a.id, 'approved')}>Tasdiqlash</button>
              <button className="btn sm" onClick={() => review(a.id, 'needs_info')}>Qo‘shimcha ma’lumot</button>
              <button className="btn sm danger" onClick={() => review(a.id, 'rejected')}>Rad etish</button>
            </div>
          </div>
        );
      })}
      <p className="small muted">Holatlar: {Object.values(STATUS_LABEL).join(' · ')}</p>
    </div>
  );
}

function VacancyQueue() {
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    const { data, error } = await supabase.from('vacancies').select('id,kind,title,category,description,created_at,status')
      .in('status', ['submitted', 'in_review']).order('created_at');
    if (error) setError(errMsg(error)); else setItems((data ?? []) as Record<string, unknown>[]);
  };
  useEffect(() => { load(); }, []);

  const review = async (id: string, status: 'approved' | 'rejected' | 'needs_info') => {
    let reason: string | null = null;
    if (status !== 'approved') { reason = askReason(); if (!reason) return; }
    const { error } = await supabase.rpc('admin_review_vacancy', { p_vacancy: id, p_status: status, p_reason: reason });
    if (error) setError(errMsg(error)); else load();
  };

  if (!items && !error) return <Loading />;
  return (
    <div className="stack">
      <ErrorBox error={error} />
      {items?.length === 0 && <Empty>Tekshiruv navbati bo‘sh.</Empty>}
      {items?.map((v) => (
        <div key={String(v.id)} className="card stack">
          <div className="row between"><h3 style={{ margin: 0 }}>{String(v.title)}</h3><span className="badge">{v.kind === 'casting' ? 'Casting' : 'Vakansiya'} · {String(v.category)}</span></div>
          <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{String(v.description)}</p>
          <div className="row">
            <button className="btn sm primary" onClick={() => review(String(v.id), 'approved')}>Tasdiqlash (saytda + Telegram)</button>
            <button className="btn sm" onClick={() => review(String(v.id), 'needs_info')}>Tuzatish so‘rash</button>
            <button className="btn sm danger" onClick={() => review(String(v.id), 'rejected')}>Rad etish</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Tickets() {
  const [items, setItems] = useState<{ id: string; subject: string; category: string; status: string; created_at: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = async () => {
    const { data, error } = await supabase.from('support_tickets').select('id,subject,category,status,created_at').order('created_at', { ascending: false }).limit(200);
    if (error) setError(errMsg(error)); else setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);
    if (error) setError(errMsg(error)); else load();
  };
  const send = async (id: string) => {
    if (!reply.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('support_messages').insert({ ticket_id: id, author_id: user!.id, is_staff: true, body: reply.trim() });
    if (error) setError(errMsg(error)); else { setReply(''); setStatus(id, 'answered'); }
  };

  if (!items && !error) return <Loading />;
  return (
    <div className="stack">
      <ErrorBox error={error} />
      {items?.map((t) => (
        <div key={t.id} className="card stack">
          <div className="row between">
            <button className="btn sm ghost" style={{ padding: 0 }} onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>{t.subject}</button>
            <span className="small muted">{TICKET_CATEGORIES[t.category]} · {fmtDate(t.created_at)}</span>
            <select aria-label="Holat" className="select" style={{ width: 'auto' }} value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
              <option value="new">Yangi</option><option value="in_progress">Jarayonda</option><option value="answered">Javob berildi</option><option value="closed">Yopildi</option>
            </select>
          </div>
          {open === t.id && (
            <div className="row">
              <input className="input" style={{ flex: 1 }} aria-label="Javob matni" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="btn primary" onClick={() => send(t.id)}>Javob yuborish</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Audit() {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('audit_log').select('id,action,entity,entity_id,old_status,new_status,reason,created_at').order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) setError(errMsg(error)); else setRows((data ?? []) as Record<string, unknown>[]); });
  }, []);
  if (!rows && !error) return <Loading />;
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <ErrorBox error={error} />
      <table className="table">
        <thead><tr><th>Vaqt</th><th>Amal</th><th>Obyekt</th><th>Eski → yangi</th><th>Sabab</th></tr></thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={String(r.id)}>
              <td>{fmtDate(String(r.created_at))}</td>
              <td>{String(r.action)}</td>
              <td className="small">{String(r.entity)} {String(r.entity_id).slice(0, 8)}</td>
              <td>{String(r.old_status)} → {String(r.new_status)}</td>
              <td>{String(r.reason ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Rahbar only: grant/revoke admin role by email. Server enforces the same rule.
export function StaffPanel() {
  const [rows, setRows] = useState<{ user_id: string; email: string; role: string; created_at: string }[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'owner'>('admin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc('list_staff');
    if (error) { setError(errMsg(error)); return; }
    setRows((data ?? []) as { user_id: string; email: string; role: string; created_at: string }[]);
  };
  useEffect(() => { void load(); }, []);

  const change = async (grant: boolean) => {
    setError(null); setOk(null);
    if (!email.trim()) { setError('Email kiriting'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('set_user_role_by_email', { p_email: email.trim(), p_role: role, p_grant: grant });
    setBusy(false);
    if (error) { setError(errMsg(error)); return; }
    setOk(`${email.trim()} uchun ${role === 'owner' ? 'rahbar' : 'admin'} roli ${grant ? 'berildi' : 'olib tashlandi'}`);
    setEmail('');
    void load();
  };

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Rol berish</h2>
        <p className="small">Foydalanuvchi avval saytda ro‘yxatdan o‘tgan bo‘lishi kerak.</p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input placeholder="email@misol.uz" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'owner')}>
            <option value="admin">Admin</option>
            <option value="owner">Rahbar</option>
          </select>
          <button className="btn primary" disabled={busy} onClick={() => void change(true)}>Berish</button>
          <button className="btn" disabled={busy} onClick={() => void change(false)}>Olib tashlash</button>
        </div>
        {ok && <div className="notice ok" role="status" style={{ marginTop: 12 }}>{ok}</div>}
        {error && <div className="notice error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      </div>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty>Hozircha admin yo‘q</Empty> : (
        <table className="table">
          <thead><tr><th>Email</th><th>Rol</th><th>Berilgan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.user_id}-${r.role}`}>
                <td>{r.email}</td>
                <td>{r.role === 'owner' ? 'Rahbar' : 'Admin'}</td>
                <td>{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
