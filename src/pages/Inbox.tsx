import { useEffect, useRef, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import { useAuth, type Account } from '../lib/auth';
import { Empty, ErrorBox, Loading, errMsg } from '../components/ui';
import { back } from '../lib/router';

interface ConvRow { id: string; last_message_at: string; context_type: string | null }
interface Msg { id: string; conversation_id: string; sender_account_id: string; body: string; created_at: string }

// Inbox: all conversations of the accounts I own, with the other side's name.
export function Inbox() {
  const { accounts } = useAuth();
  const [rows, setRows] = useState<{ conv: ConvRow; other: Account | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mine = accounts.map((a) => a.id);
    if (!mine.length) { setRows([]); return; }
    (async () => {
      const { data: parts, error: e1 } = await supabase.from('conversation_participants').select('conversation_id,account_id').in('account_id', mine);
      if (e1) { setError(errMsg(e1)); return; }
      const convIds = [...new Set((parts ?? []).map((p) => p.conversation_id))];
      if (!convIds.length) { setRows([]); return; }
      const [{ data: convs }, { data: all }] = await Promise.all([
        supabase.from('conversations').select('id,last_message_at,context_type').in('id', convIds).order('last_message_at', { ascending: false }),
        supabase.from('conversation_participants').select('conversation_id,account_id').in('conversation_id', convIds)
      ]);
      const otherIds = [...new Set((all ?? []).filter((p) => !mine.includes(p.account_id)).map((p) => p.account_id))];
      const { data: others } = otherIds.length
        ? await supabase.from('accounts').select(ACCOUNT_COLS).in('id', otherIds)
        : { data: [] as unknown[] };
      const byId = Object.fromEntries(((others ?? []) as unknown as Account[]).map((a) => [a.id, a]));
      setRows((convs ?? []).map((c) => {
        const otherPart = (all ?? []).find((p) => p.conversation_id === c.id && !mine.includes(p.account_id));
        return { conv: c as ConvRow, other: otherPart ? byId[otherPart.account_id] ?? null : null };
      }));
    })();
  }, [accounts]);

  return (
    <section>
      <h1>Xabarlar</h1>
      <ErrorBox error={error} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>Hali suhbat yo‘q. Mutaxassis yoki kompaniya profilidan “Yozish” tugmasini bosing.</Empty> : (
        <div className="stack">
          {rows.map(({ conv, other }) => (
            <a key={conv.id} href={`#/chat/${conv.id}`} className="card hover row between">
              <span>{other?.display_name ?? 'Suhbat'}</span>
              <span className="small muted">{new Date(conv.last_message_at).toLocaleString('uz-UZ')}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export function Chat({ id }: { id: string }) {
  const { accounts } = useAuth();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const mine = accounts.map((a) => a.id);

  const load = async () => {
    const { data, error } = await supabase.from('messages').select('id,conversation_id,sender_account_id,body,created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true }).limit(500);
    if (error) setError(errMsg(error)); else setMsgs((data ?? []) as Msg[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`conv-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !mine.length) return;
    setSending(true); setError(null);
    // Pick the account that is a participant in this conversation.
    const { data: part } = await supabase.from('conversation_participants').select('account_id').eq('conversation_id', id).in('account_id', mine).limit(1).maybeSingle();
    if (!part) { setSending(false); setError('Bu suhbatda ishtirok etmaysiz'); return; }
    const { error } = await supabase.from('messages').insert({ conversation_id: id, sender_account_id: part.account_id, body });
    setSending(false);
    if (error) setError(errMsg(error)); else { setText(''); load(); }
  };

  return (
    <section aria-labelledby="chat-title" className="stack">
      <button className="btn sm ghost" onClick={() => back('/inbox')}>← Orqaga</button>
      <h1 id="chat-title" style={{ fontSize: 24 }}>Suhbat</h1>
      <ErrorBox error={error} />
      <div className="card" style={{ minHeight: 280, maxHeight: '60vh', overflowY: 'auto' }} aria-live="polite">
        {!msgs ? <Loading /> : msgs.length === 0 ? <p className="small">Xabar yo‘q. Birinchi bo‘lib yozing.</p> : msgs.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: mine.includes(m.sender_account_id) ? 'flex-end' : 'flex-start', margin: '6px 0' }}>
            <div style={{ maxWidth: '75%', background: mine.includes(m.sender_account_id) ? 'var(--surface-2)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px' }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
              <div className="small muted">{new Date(m.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="row">
        <label htmlFor="msg" className="sr-only" style={{ position: 'absolute', left: -9999 }}>Xabar</label>
        <input id="msg" className="input" style={{ flex: 1 }} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Xabar yozing…" />
        <button className="btn primary" disabled={sending || !text.trim()}>Yuborish</button>
      </form>
    </section>
  );
}
