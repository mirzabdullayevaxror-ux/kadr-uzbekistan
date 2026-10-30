import { useEffect, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import { useAuth, type Account } from '../lib/auth';
import { KIND_LABEL, KIND_PATH, NEEDS_APPROVAL, EMPLOYMENT, WORK_MODE, VACANCY_CATEGORIES, type AccountKind } from '../lib/constants';
import { Empty, ErrorBox, Loading, StatusBadge, errMsg, fmtDate, fmtMoney } from '../components/ui';
import { go } from '../lib/router';
import { useRegions } from '../lib/regions';
import { AiAssist } from '../components/AiAssist';

const ALL_KINDS: AccountKind[] = ['mutaxassis', 'mijoz', 'kompaniya', 'sotuvchi', 'oquv_markazi'];
const VCOLS = 'id,account_id,kind,title,category,employment_type,work_mode,region_code,city,salary_min,salary_max,deadline,status,reject_reason,created_at';

interface V { id: string; account_id: string; kind: string; title: string; category: string; employment_type: string | null; work_mode: string | null; region_code: string | null; city: string | null; salary_min: number | null; salary_max: number | null; deadline: string | null; status: string; reject_reason: string | null; created_at: string }
interface Offer { id: string; from_account_id: string; to_account_id: string; title: string; budget: number | null; status: string; created_at: string; event_date: string | null; note: string | null }
interface App { id: string; vacancy_id: string; applicant_account_id: string; status: string; message: string | null; created_at: string }

export function Dashboard() {
  const { accounts, refresh, accountsReady, isOwner } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const missing = ALL_KINDS.filter((k) => !accounts.some((a) => a.kind === k));

  const submit = async (id: string) => {
    setError(null); setNotice(null);
    const { error } = await supabase.rpc('submit_account', { p_account: id });
    if (error) setError(errMsg(error)); else { setNotice('Tekshiruvga yuborildi.'); await refresh(); }
  };

  if (!accountsReady) return <Loading label="Akkauntlaringiz yuklanmoqda…" />;

  return (
    <section aria-labelledby="dash-title">
      <div className="row between">
        <h1 id="dash-title">Kabinet</h1>
        {missing.length > 0 && <a className="btn" href="#/onboarding">+ Yangi rol / akkaunt</a>}
      </div>
      <ErrorBox error={error} />
      {notice && <div className="notice ok" role="status">{notice}</div>}

      {accounts.length === 0 ? (
        <Empty>
          Hali akkaunt yo‘q. <a href="#/onboarding" className="btn primary sm" style={{ marginLeft: 8 }}>Rolni tanlang</a>
        </Empty>
      ) : (
        <div className="grid">
          {accounts.map((a: Account) => (
            <div key={a.id} className="card stack">
              <div className="row between">
                <h3 style={{ margin: 0 }}>{a.display_name}</h3>
                <StatusBadge status={a.status} />
              </div>
              <p className="small" style={{ margin: 0 }}>{isOwner && a.kind === 'mijoz' ? 'Rahbar' : KIND_LABEL[a.kind]} · @{a.username}</p>
              {a.status === 'rejected' || a.status === 'needs_info' ? (
                <div className="notice error small">Sabab: {a.reject_reason}</div>
              ) : null}
              <div className="row">
                <a className="btn sm" href={`#/${KIND_PATH[a.kind]}/${a.username}`}>Profilni ko‘rish</a>
                <button className="btn sm" onClick={() => go(`/edit/${a.id}`)}>Tahrirlash</button>
                {NEEDS_APPROVAL[a.kind] && ['draft', 'needs_info', 'rejected'].includes(a.status) && (
                  <button className="btn sm primary" onClick={() => submit(a.id)}>Tekshiruvga yuborish</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {accounts.filter((a) => a.kind === 'mijoz' || a.kind === 'kompaniya').map((a) => (
        <VacancyManager key={a.id} account={a} />
      ))}

      <ApplicationsForMe />
      <OffersPanel />

      <div className="row" style={{ marginTop: 32 }}>
        <a className="btn" href="#/inbox">Xabarlar</a>
        <a className="btn" href="#/support">Yordam</a>
      </div>
    </section>
  );
}

function VacancyManager({ account }: { account: Account }) {
  const regions = useRegions();
  const [items, setItems] = useState<V[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ kind: 'vacancy', title: '', category: VACANCY_CATEGORIES[0], description: '', employment_type: 'full', work_mode: 'office', region_code: '', city: '', salary_min: '', salary_max: '', deadline: '', fee: '' });

  const load = async () => {
    const { data } = await supabase.from('vacancies').select(VCOLS).eq('account_id', account.id).order('created_at', { ascending: false });
    setItems((data ?? []) as unknown as V[]);
  };
  useEffect(() => { load(); }, [account.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.title.trim().length < 3 || f.description.trim().length < 10) { setError('Sarlavha (3+) va tavsif (10+ belgi) kiriting'); return; }
    setBusy(true); setError(null);
    const details = f.kind === 'casting' && f.fee ? { fee: f.fee } : {};
    const { error } = await supabase.from('vacancies').insert({
      account_id: account.id, kind: f.kind, title: f.title.trim(), category: f.category, description: f.description.trim(),
      employment_type: f.kind === 'vacancy' ? f.employment_type : null, work_mode: f.kind === 'vacancy' ? f.work_mode : null,
      region_code: f.region_code || null, city: f.city || null,
      salary_min: f.salary_min ? Number(f.salary_min) : null, salary_max: f.salary_max ? Number(f.salary_max) : null,
      deadline: f.deadline || null, details
    });
    setBusy(false);
    if (error) { setError(errMsg(error)); return; }
    setOpen(false);
    setF({ ...f, title: '', description: '' });
    load();
  };

  const submitOne = async (id: string) => {
    const { error } = await supabase.rpc('submit_vacancy', { p_vacancy: id });
    if (error) setError(errMsg(error)); else load();
  };

  return (
    <div className="card stack" style={{ marginTop: 24 }}>
      <div className="row between">
        <h2 style={{ fontSize: 20, margin: 0 }}>E’lonlarim — {account.display_name}</h2>
        <button className="btn sm primary" onClick={() => setOpen(!open)}>{open ? 'Yopish' : '+ E’lon joylash (bepul)'}</button>
      </div>
      <ErrorBox error={error} />

      {open && (
        <form onSubmit={create} noValidate className="stack">
          <div className="two">
            <div className="field"><label htmlFor={`k-${account.id}`}>Turi</label>
              <select id={`k-${account.id}`} className="select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="vacancy">Vakansiya</option><option value="casting">Casting</option>
              </select></div>
            <div className="field"><label htmlFor={`c-${account.id}`}>Kategoriya</label>
              <select id={`c-${account.id}`} className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {VACANCY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
          <div className="field"><label htmlFor={`t-${account.id}`}>Sarlavha</label>
            <input id={`t-${account.id}`} className="input" value={f.title} maxLength={150} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="field"><label htmlFor={`d-${account.id}`}>Tavsif</label>
            <textarea id={`d-${account.id}`} className="textarea" value={f.description} maxLength={6000} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <AiAssist task="vacancy" onResult={(t) => setF((prev) => ({ ...prev, description: t.slice(0, 6000) }))} /></div>
          <div className="two">
            {f.kind === 'vacancy' && <div className="field"><label htmlFor={`e-${account.id}`}>Ish turi</label>
              <select id={`e-${account.id}`} className="select" value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value })}>
                {Object.entries(EMPLOYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>}
            {f.kind === 'vacancy' && <div className="field"><label htmlFor={`w-${account.id}`}>Ish formati</label>
              <select id={`w-${account.id}`} className="select" value={f.work_mode} onChange={(e) => setF({ ...f, work_mode: e.target.value })}>
                {Object.entries(WORK_MODE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>}
            <div className="field"><label htmlFor={`r-${account.id}`}>Viloyat</label>
              <select id={`r-${account.id}`} className="select" value={f.region_code} onChange={(e) => setF({ ...f, region_code: e.target.value })}>
                <option value="">Tanlang</option>{regions.map((r) => <option key={r.code} value={r.code}>{r.name_uz}</option>)}
              </select></div>
            <div className="field"><label htmlFor={`cy-${account.id}`}>Shahar / tuman</label>
              <input id={`cy-${account.id}`} className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
            <div className="field"><label htmlFor={`s1-${account.id}`}>Maosh dan (so‘m)</label>
              <input id={`s1-${account.id}`} type="number" min={0} className="input" value={f.salary_min} onChange={(e) => setF({ ...f, salary_min: e.target.value })} /></div>
            <div className="field"><label htmlFor={`s2-${account.id}`}>Maosh gacha (so‘m)</label>
              <input id={`s2-${account.id}`} type="number" min={0} className="input" value={f.salary_max} onChange={(e) => setF({ ...f, salary_max: e.target.value })} /></div>
            <div className="field"><label htmlFor={`dl-${account.id}`}>Oxirgi muddat</label>
              <input id={`dl-${account.id}`} type="date" className="input" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
            {f.kind === 'casting' && <div className="field"><label htmlFor={`fe-${account.id}`}>Haq (ixtiyoriy)</label>
              <input id={`fe-${account.id}`} className="input" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></div>}
          </div>
          <button className="btn primary" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Qoralama saqlash'}</button>
          <p className="small">Saqlangach “Tekshiruvga yuborish” tugmasini bosing. Admin tasdiqlagach saytda va Telegram kanalida chiqadi.</p>
        </form>
      )}

      {items.length === 0 ? <p className="small">Hali e’lon yo‘q.</p> : (
        <table className="table">
          <thead><tr><th>Sarlavha</th><th>Turi</th><th>Holat</th><th>Amal</th></tr></thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td><a href={`#/vacancy/${v.id}`}>{v.title}</a><div className="small muted">{fmtDate(v.created_at)}</div></td>
                <td>{v.kind === 'casting' ? 'Casting' : 'Vakansiya'}</td>
                <td><StatusBadge status={v.status} />{v.reject_reason && <div className="small" style={{ color: 'var(--danger)' }}>{v.reject_reason}</div>}</td>
                <td>{['draft', 'needs_info', 'rejected'].includes(v.status) && <button className="btn sm" onClick={() => submitOne(v.id)}>Yuborish</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ApplicationsForMe() {
  const { accounts } = useAuth();
  const [rows, setRows] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = accounts.map((a) => a.id);
  const talent = accounts.find((a) => a.kind === 'mutaxassis');
  const org = accounts.filter((a) => a.kind === 'mijoz' || a.kind === 'kompaniya');

  useEffect(() => {
    if (!accounts.length) return;
    supabase.from('applications').select('id,vacancy_id,applicant_account_id,status,message,created_at')
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { if (error) setError(errMsg(error)); else setRows((data ?? []) as App[]); });
  }, [accounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!accounts.length) return null;
  const mine = (rows ?? []).filter((r) => r.applicant_account_id && talent && r.applicant_account_id === talent.id);
  const incoming = (rows ?? []).filter((r) => talent ? r.applicant_account_id !== talent.id : false);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('applications').update({ status }).eq('id', id);
    if (error) setError(errMsg(error));
    else setRows((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, status } : r)));
  };
  void ids; void org;

  return (
    <div className="two" style={{ marginTop: 24 }}>
      <div className="card">
        <h2 style={{ fontSize: 20 }}>Mening arizalarim</h2>
        <ErrorBox error={error} />
        {!talent ? <p className="small">Mutaxassis akkaunti yo‘q. <a href="#/onboarding/mutaxassis">Yarating</a>.</p>
          : mine.length === 0 ? <p className="small">Hali ariza yo‘q.</p>
          : <ul className="stack" style={{ paddingLeft: 0, listStyle: 'none' }}>{mine.map((r) => (
              <li key={r.id} className="small"><a href={`#/vacancy/${r.vacancy_id}`}>E’lon</a> · <StatusBadge status={r.status} /> · {fmtDate(r.created_at)}</li>
            ))}</ul>}
      </div>
      <div className="card">
        <h2 style={{ fontSize: 20 }}>Kelgan arizalar</h2>
        {incoming.length === 0 ? <p className="small">Hali ariza kelmagan.</p> : (
          <ul className="stack" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {incoming.map((r) => (
              <li key={r.id} className="small stack">
                <div>E’lon: <a href={`#/vacancy/${r.vacancy_id}`}>{r.vacancy_id.slice(0, 8)}</a> · <StatusBadge status={r.status} /></div>
                {r.message && <div className="muted">“{r.message}”</div>}
                <div className="row">
                  <button className="btn sm" onClick={() => setStatus(r.id, 'shortlisted')}>Shortlist</button>
                  <button className="btn sm danger" onClick={() => setStatus(r.id, 'rejected')}>Rad etish</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OffersPanel() {
  const { accounts } = useAuth();
  const [rows, setRows] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ids = accounts.map((a) => a.id);

  const load = async () => {
    if (!ids.length) return;
    const { data, error } = await supabase.from('offers').select('id,from_account_id,to_account_id,title,budget,status,created_at,event_date,note')
      .order('created_at', { ascending: false }).limit(100);
    if (error) setError(errMsg(error)); else setRows((data ?? []) as Offer[]);
  };
  useEffect(() => { load(); }, [accounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id: string, action: string, budget?: number) => {
    const { error } = await supabase.rpc('respond_offer', { p_offer: id, p_action: action, p_budget: budget ?? null, p_note: null });
    if (error) setError(errMsg(error)); else load();
  };

  if (!accounts.length) return null;
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 20 }}>Takliflar</h2>
      <ErrorBox error={error} />
      {rows.length === 0 ? <p className="small">Taklif yo‘q.</p> : (
        <table className="table">
          <thead><tr><th>Taklif</th><th>Byudjet</th><th>Holat</th><th>Amal</th></tr></thead>
          <tbody>
            {rows.map((o) => {
              const incoming = ids.includes(o.to_account_id);
              return (
                <tr key={o.id}>
                  <td>{o.title}<div className="small muted">{incoming ? 'Kiruvchi' : 'Yuborilgan'} · {fmtDate(o.created_at)}</div></td>
                  <td>{fmtMoney(o.budget)}</td>
                  <td>{o.status}</td>
                  <td>
                    {o.status === 'pending' && incoming && (
                      <div className="row">
                        <button className="btn sm primary" onClick={() => act(o.id, 'accept')}>Qabul</button>
                        <button className="btn sm" onClick={() => {
                          const v = window.prompt('Qarshi narx (so‘m):');
                          if (v && Number(v) > 0) act(o.id, 'counter', Number(v));
                        }}>Qarshi taklif</button>
                        <button className="btn sm danger" onClick={() => act(o.id, 'reject')}>Rad</button>
                      </div>
                    )}
                    {o.status === 'pending' && !incoming && <button className="btn sm" onClick={() => act(o.id, 'cancel')}>Bekor qilish</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
