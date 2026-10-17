import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TICKET_CATEGORIES } from '../lib/constants';
import { Empty, ErrorBox, Loading, StatusBadge, errMsg, fmtDate } from '../components/ui';

interface Ticket { id: string; category: string; subject: string; status: string; created_at: string }
interface TMsg { id: string; body: string; is_staff: boolean; author_id: string; created_at: string }

export function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ category: 'account', subject: '', body: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('support_tickets').select('id,category,subject,status,created_at').order('created_at', { ascending: false });
    if (error) setError(errMsg(error)); else setTickets((data ?? []) as Ticket[]);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.subject.trim().length < 3 || !f.body.trim()) { setError('Mavzu (3+ belgi) va xabar matnini kiriting'); return; }
    setBusy(true); setError(null);
    const { data, error } = await supabase.from('support_tickets').insert({ owner_id: user!.id, category: f.category, subject: f.subject.trim() }).select('id').single();
    if (error || !data) { setBusy(false); setError(error ? errMsg(error) : 'Murojaat yaratilmadi'); return; }
    const { error: mErr } = await supabase.from('support_messages').insert({ ticket_id: data.id, author_id: user!.id, body: f.body.trim() });
    setBusy(false);
    if (mErr) { setError(errMsg(mErr)); return; }
    setF({ category: 'account', subject: '', body: '' });
    load();
    setOpen(data.id);
  };

  return (
    <section className="stack" aria-labelledby="sup-title">
      <h1 id="sup-title">Yordam / Support</h1>
      <p className="muted">Murojaatlar admin jamoasiga yetkaziladi. Javoblar shu sahifada chiqadi.</p>
      <ErrorBox error={error} />

      <form className="card" onSubmit={create} noValidate>
        <h2 style={{ fontSize: 20 }}>Yangi murojaat</h2>
        <div className="two">
          <div className="field"><label htmlFor="sc">Kategoriya</label>
            <select id="sc" className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="field"><label htmlFor="ss">Mavzu</label>
            <input id="ss" className="input" maxLength={150} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="sb">Xabar</label>
          <textarea id="sb" className="textarea" maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Yuborilmoqda…' : 'Yuborish'}</button>
      </form>

      <h2 style={{ fontSize: 20 }}>Murojaatlarim</h2>
      {!tickets ? <Loading /> : tickets.length === 0 ? <Empty>Murojaat yo‘q.</Empty> : (
        <div className="stack">
          {tickets.map((t) => (
            <div key={t.id} className="card">
              <button className="row between" style={{ width: '100%', background: 'none', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
                onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
                <span>{t.subject} <span className="small muted">· {TICKET_CATEGORIES[t.category]} · {fmtDate(t.created_at)}</span></span>
                <StatusBadge status={t.status} />
              </button>
              {open === t.id && <TicketThread id={t.id} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TicketThread({ id }: { id: string }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<TMsg[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('support_messages').select('id,body,is_staff,author_id,created_at').eq('ticket_id', id).order('created_at');
    if (error) setError(errMsg(error)); else setMsgs((data ?? []) as TMsg[]);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const { error } = await supabase.from('support_messages').insert({ ticket_id: id, author_id: user!.id, body: text.trim() });
    if (error) setError(errMsg(error)); else { setText(''); load(); }
  };

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <ErrorBox error={error} />
      {!msgs ? <Loading /> : msgs.map((m) => (
        <div key={m.id} className="notice small" style={{ borderColor: m.is_staff ? '#6b3a00' : 'var(--border)' }}>
          <b>{m.is_staff ? 'Support' : 'Siz'}:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>
        </div>
      ))}
      <form onSubmit={reply} className="row">
        <input className="input" style={{ flex: 1 }} aria-label="Javob" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        <button className="btn">Javob</button>
      </form>
    </div>
  );
}
