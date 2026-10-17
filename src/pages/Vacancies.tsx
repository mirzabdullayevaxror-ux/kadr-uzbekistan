import { useEffect, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import type { Account } from '../lib/auth';
import { useAuth } from '../lib/auth';
import { EMPLOYMENT, WORK_MODE, KIND_PATH } from '../lib/constants';
import { Empty, ErrorBox, Loading, errMsg, fmtDate, fmtMoney } from '../components/ui';
import { back } from '../lib/router';
import { go } from '../lib/router';
import { useRegions } from '../lib/regions';

interface Vacancy {
  id: string; account_id: string; kind: 'vacancy' | 'casting'; title: string; category: string;
  description: string; employment_type: string | null; work_mode: string | null; region_code: string | null;
  city: string | null; salary_min: number | null; salary_max: number | null; deadline: string | null;
  details: Record<string, unknown>; created_at: string; status: string;
}

const COLS = 'id,account_id,kind,title,category,description,employment_type,work_mode,region_code,city,salary_min,salary_max,deadline,details,created_at,status';

// Public list of admin-approved vacancies or castings. Posting is free; moderation is by admin.
export function Vacancies({ kind }: { kind: 'vacancy' | 'casting' }) {
  const [items, setItems] = useState<Vacancy[] | null>(null);
  const [owners, setOwners] = useState<Record<string, Account>>({});
  const [error, setError] = useState<string | null>(null);
  const regions = useRegions();
  const regionName = (c: string | null) => regions.find((r) => r.code === c)?.name_uz ?? '';

  useEffect(() => {
    supabase.from('vacancies').select(COLS).eq('status', 'approved').eq('kind', kind)
      .order('created_at', { ascending: false }).limit(100)
      .then(async ({ data, error }) => {
        if (error) { setError(errMsg(error)); return; }
        const rows = (data ?? []) as unknown as Vacancy[];
        setItems(rows);
        const ids = [...new Set(rows.map((r) => r.account_id))];
        if (ids.length) {
          const { data: accs } = await supabase.from('accounts').select(ACCOUNT_COLS).in('id', ids);
          setOwners(Object.fromEntries(((accs ?? []) as unknown as Account[]).map((a) => [a.id, a])));
        }
      });
  }, [kind]);

  const title = kind === 'casting' ? 'Casting' : 'Vakansiyalar';
  return (
    <section aria-labelledby="vac-title">
      <div className="row between">
        <div>
          <h1 id="vac-title">{title}</h1>
          <p className="muted">{kind === 'casting' ? '🎭 CASTING' : '💼 VAKANSIYA'} · Joylash bepul, admin tekshiruvidan so‘ng chiqadi.</p>
        </div>
        <a className="btn primary" href="#/dashboard">+ E’lon joylash</a>
      </div>
      <ErrorBox error={error} />
      {!items && !error && <Loading />}
      {items && items.length === 0 && <Empty>Hozircha tasdiqlangan {kind === 'casting' ? 'casting' : 'vakansiya'} yo‘q.</Empty>}
      {items && items.length > 0 && (
        <div className="grid" aria-live="polite">
          {items.map((v) => (
            <a key={v.id} href={`#/vacancy/${v.id}`} className="card hover">
              <p className="small" style={{ margin: 0, color: 'var(--accent)', fontWeight: 700 }}>{v.category}</p>
              <h3>{v.title}</h3>
              <p className="small">{owners[v.account_id]?.display_name ?? ''}</p>
              <p className="small">
                {[EMPLOYMENT[v.employment_type ?? ''], WORK_MODE[v.work_mode ?? ''], regionName(v.region_code)].filter(Boolean).join(' · ')}
              </p>
              <p className="small" style={{ marginBottom: 0 }}>
                {v.salary_min || v.salary_max ? `${fmtMoney(v.salary_min)} – ${fmtMoney(v.salary_max)}` : ''}
              </p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export function VacancyDetail({ id }: { id: string }) {
  const { accounts, user } = useAuth();
  const regions = useRegions();
  const [v, setV] = useState<Vacancy | null | undefined>(undefined);
  const [owner, setOwner] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('vacancies').select(COLS).eq('id', id).maybeSingle().then(async ({ data, error }) => {
      if (error) { setError(errMsg(error)); return; }
      const row = (data ?? null) as unknown as Vacancy | null;
      setV(row);
      if (row) {
        const { data: a } = await supabase.from('accounts').select(ACCOUNT_COLS).eq('id', row.account_id).maybeSingle();
        setOwner((a ?? null) as unknown as Account | null);
      }
    });
  }, [id]);

  if (error) return <ErrorBox error={error} />;
  if (v === undefined) return <Loading />;
  if (v === null) return <Empty>E’lon topilmadi yoki hali tasdiqlanmagan.</Empty>;

  const talent = accounts.find((a) => a.kind === 'mutaxassis' && a.status === 'approved');
  const isOwner = accounts.some((a) => a.id === v.account_id);
  const regionName = regions.find((r) => r.code === v.region_code)?.name_uz ?? '';
  const d = v.details as Record<string, string>;

  const apply = async () => {
    if (!talent) return;
    setBusy(true); setError(null);
    const { error } = await supabase.from('applications').insert({
      vacancy_id: v.id, applicant_account_id: talent.id, message: msg.trim() || null
    });
    setBusy(false);
    if (error) setError(errMsg(error)); else setApplied(true);
  };

  return (
    <article aria-labelledby="vd-title">
      <button className="btn sm ghost" onClick={() => back(v.kind === 'casting' ? '/casting' : '/vacancies')} style={{ marginBottom: 14 }}>← Orqaga</button>
      <div className="card">
        <p className="small" style={{ color: 'var(--accent)', fontWeight: 700, margin: 0 }}>{v.kind === 'casting' ? '🎭 CASTING' : '💼 VAKANSIYA'} · {v.category}</p>
        <h1 id="vd-title" style={{ fontSize: 28, marginTop: 6 }}>{v.title}</h1>
        {owner && <p className="small">
          <a href={`#/${KIND_PATH[owner.kind]}/${owner.username}`}>{owner.display_name}</a>
        </p>}
        <div className="chips" style={{ margin: '12px 0' }}>
          {v.employment_type && <span className="chip">{EMPLOYMENT[v.employment_type]}</span>}
          {v.work_mode && <span className="chip">{WORK_MODE[v.work_mode]}</span>}
          {regionName && <span className="chip">{regionName}{v.city ? `, ${v.city}` : ''}</span>}
          {v.deadline && <span className="chip">Muddat: {fmtDate(v.deadline)}</span>}
          {(v.salary_min || v.salary_max) && <span className="chip">{fmtMoney(v.salary_min)} – {fmtMoney(v.salary_max)}</span>}
          {d.fee && <span className="chip">Haq: {d.fee}</span>}
        </div>
        <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{v.description}</p>

        {applied ? (
          <div className="notice ok" role="status">Arizangiz yuborildi. Egasi ko‘rib chiqadi.</div>
        ) : user && talent && !isOwner ? (
          <div style={{ marginTop: 18 }}>
            <div className="field">
              <label htmlFor="amsg">Ariza uchun xabar (ixtiyoriy)</label>
              <textarea id="amsg" className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
            </div>
            <button className="btn primary" disabled={busy} onClick={apply}>Ariza topshirish</button>
          </div>
        ) : !user ? (
          <div className="row" style={{ marginTop: 18 }}><a className="btn primary" href="#/login">Ariza uchun kiring</a></div>
        ) : null}
        <ErrorBox error={error} />
        {user && !talent && !isOwner && (
          <p className="small" style={{ marginTop: 14 }}>Ariza topshirish uchun tasdiqlangan Mutaxassis akkaunti kerak. <a href="#/onboarding/mutaxassis">Akkaunt yarating</a>.</p>
        )}
        {isOwner && <p className="small" style={{ marginTop: 14 }}>Bu sizning e’loningiz. Arizalarni <a href="#/dashboard">kabinetda</a> ko‘ring.</p>}
      </div>
    </article>
  );
}

export type { Vacancy };
export { go };
