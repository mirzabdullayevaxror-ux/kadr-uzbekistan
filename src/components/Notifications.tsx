import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { fmtDate } from './ui';

type Note = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

// Bell with unread count and a dropdown list. Reads only the signed-in user's rows (RLS).
export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase.from('notifications')
      .select('id,title,body,link,read_at,created_at')
      .order('created_at', { ascending: false }).limit(30);
    setItems((data ?? []) as Note[]);
  };

  // initial load + light polling so new announcements appear without a reload
  useEffect(() => {
    if (!user) { setItems([]); return; }
    void load();
    const t = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(t);
  }, [user?.id]);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!user) return null;

  const unread = items.filter((n) => !n.read_at).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  const markAllRead = async () => {
    await supabase.rpc('mark_notifications_read', { p_ids: null });
    void load();
  };

  const openItem = async (n: Note) => {
    if (!n.read_at) await supabase.rpc('mark_notifications_read', { p_ids: [n.id] });
    setOpen(false);
    if (n.link) window.location.hash = n.link.replace(/^#/, '');
    void load();
  };

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button className="btn sm ghost" onClick={() => void toggle()} aria-haspopup="true" aria-expanded={open}
        aria-label={unread ? `Bildirishnomalar: ${unread} ta o‘qilmagan` : 'Bildirishnomalar'}>
        🔔{unread > 0 && <span style={{ marginLeft: 6, background: 'var(--accent)', color: '#000', borderRadius: 999, padding: '0 7px', fontSize: 12, fontWeight: 700 }}>{unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Bildirishnomalar" className="card"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 40, padding: 12, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>Bildirishnomalar</strong>
            {unread > 0 && <button className="btn sm ghost" onClick={() => void markAllRead()}>Hammasini o‘qildi</button>}
          </div>
          {items.length === 0 && <p className="small" style={{ margin: 0 }}>Hozircha bildirishnoma yo‘q.</p>}
          <div className="stack" style={{ gap: 6 }}>
            {items.map((n) => (
              <button key={n.id} onClick={() => void openItem(n)}
                style={{ textAlign: 'left', background: n.read_at ? 'transparent' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
                <div style={{ fontWeight: n.read_at ? 500 : 700 }}>{n.title}</div>
                {n.body && <div className="small" style={{ marginTop: 2 }}>{n.body}</div>}
                <div className="small" style={{ marginTop: 4, opacity: 0.7 }}>{fmtDate(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
