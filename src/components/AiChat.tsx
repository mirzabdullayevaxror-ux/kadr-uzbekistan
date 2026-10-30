import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMsg } from './ui';

// Big homepage button that opens a chat with the Gemini-backed ai-assist function.
// Only signed-in users can talk to the assistant; the API key stays on the server.
type Msg = { role: 'user' | 'assistant'; text: string };

export function AiChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const history = msgs.slice(-10);
    setMsgs((m) => [...m, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-assist', {
        body: { text, task: 'chat', history }
      });
      if (fnErr) throw fnErr;
      const reply = (data as { text?: string; error?: string } | null)?.text;
      if (!reply) throw new Error((data as { error?: string } | null)?.error ?? 'AI javob bermadi');
      setMsgs((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="ai-title" style={{ marginTop: 40 }}>
      <div className="card" style={{ padding: 22, border: '2px solid var(--accent)' }}>
        <h2 id="ai-title" style={{ marginTop: 0 }}>✨ AI yordamchi</h2>
        <p className="small" style={{ marginTop: 0 }}>
          Platforma, rollar, vakansiya va arizalar bo‘yicha savollaringizga javob oling. Profil va vakansiya matnini ham yozib beradi.
        </p>

        {!open && (
          <button className="btn primary" onClick={() => setOpen(true)}
            style={{ width: '100%', padding: '18px 20px', fontSize: 18, fontWeight: 800 }}>
            ✨ AI bilan suhbatlashish
          </button>
        )}

        {open && (
          <>
            {!user ? (
              <p className="small" style={{ margin: '12px 0 0' }}>
                Suhbatlashish uchun <a href="#/login">tizimga kiring</a>.
              </p>
            ) : (
              <>
                <div role="log" aria-live="polite" style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
                  {msgs.length === 0 && <p className="small" style={{ margin: 0 }}>Savolingizni yozing, masalan: “Vakansiyaga qanday ariza yuboraman?”</p>}
                  {msgs.map((m, i) => (
                    <div key={i} style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%', whiteSpace: 'pre-wrap', padding: '10px 14px', borderRadius: 12,
                      background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                      color: m.role === 'user' ? '#000' : 'inherit'
                    }}>{m.text}</div>
                  ))}
                  {busy && <div className="small" style={{ opacity: 0.7 }}>Yozilmoqda…</div>}
                  <div ref={endRef} />
                </div>
                {error && <p className="small" role="alert" style={{ color: '#ffb3b3' }}>{error}</p>}
                <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
                  <input id="ai-chat-input" aria-label="Xabar" className="input" style={{ flex: 1 }} maxLength={2000} value={input}
                    onChange={(e) => setInput(e.target.value)} placeholder="Savolingizni yozing…" />
                  <button className="btn primary" type="submit" disabled={busy || !input.trim()}>Yuborish</button>
                </form>
              </>
            )}
            <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>Yopish</button>
          </>
        )}
      </div>
    </section>
  );
}
