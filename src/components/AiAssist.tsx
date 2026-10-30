import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { errMsg } from './ui';

// Inline "write with AI" helper. The user gives a short brief, the server (ai-assist Edge Function)
// calls Claude, and the returned text is passed to onResult so the form field can be filled.
// The API key never reaches the browser.
export function AiAssist({ task, onResult }: { task: 'profile' | 'vacancy'; onResult: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const text = brief.trim();
    if (text.length < 10) { setError('Kamida 10 belgi yozing'); return; }
    setBusy(true); setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-assist', { body: { text, task } });
      if (fnErr) throw fnErr;
      const reply = (data as { text?: string; error?: string } | null)?.text;
      if (!reply) throw new Error((data as { error?: string } | null)?.error ?? 'AI javob bermadi');
      onResult(reply);
      setOpen(false);
      setBrief('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn sm ghost" onClick={() => setOpen(true)}>
        ✨ AI bilan yozish
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 12, marginTop: 8 }}>
      <label htmlFor={`ai-${task}`} className="small">Qisqa ma’lumot yozing, AI matnni tayyorlaydi</label>
      <textarea id={`ai-${task}`} className="textarea" maxLength={2000} value={brief}
        onChange={(e) => setBrief(e.target.value)} placeholder={task === 'profile' ? 'Masalan: 5 yil video montaj, Premiere va DaVinci, to‘y va reklama videolari' : 'Masalan: Video montajchi kerak, haftasiga 3 kun, Toshkentda'} />
      {error && <p className="small" role="alert" style={{ color: '#ffb3b3' }}>{error}</p>}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button type="button" className="btn sm" onClick={() => void run()} disabled={busy}>{busy ? 'Yozilmoqda…' : 'Yozish'}</button>
        <button type="button" className="btn sm ghost" onClick={() => setOpen(false)} disabled={busy}>Bekor qilish</button>
      </div>
    </div>
  );
}
