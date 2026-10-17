import { useEffect, useMemo, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import type { Account } from '../lib/auth';
import type { AccountKind } from '../lib/constants';
import { KIND_LABEL, KIND_PATH, PROFESSIONS, COMPANY_TYPES } from '../lib/constants';
import { Avatar, Empty, Loading, ErrorBox, errMsg } from '../components/ui';
import { useRegions } from '../lib/regions';

// Public catalog of approved accounts of one kind. Filters are applied server-side.
export function Catalog({ kind }: { kind: AccountKind }) {
  const [items, setItems] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const [profession, setProfession] = useState('');
  const [companyType, setCompanyType] = useState('');
  const regions = useRegions();

  const title = useMemo(() => {
    if (kind === 'mutaxassis') return 'Mutaxassislar';
    if (kind === 'kompaniya') return 'Kompaniyalar';
    if (kind === 'oquv_markazi') return 'O‘quv markazlari';
    return 'Sotuvchilar';
  }, [kind]);

  useEffect(() => {
    let alive = true;
    setItems(null);
    let query = supabase.from('accounts').select(ACCOUNT_COLS)
      .eq('status', 'approved').eq('kind', kind).order('created_at', { ascending: false }).limit(60);
    if (q.trim()) query = query.ilike('display_name', `%${q.trim()}%`);
    if (region) query = query.eq('region_code', region);
    if (profession && kind === 'mutaxassis') query = query.contains('professions', [profession]);
    if (companyType && kind === 'kompaniya') query = query.eq('profile_data->>company_type', companyType);
    const t = setTimeout(() => {
      query.then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(errMsg(error));
        else { setError(null); setItems((data ?? []) as unknown as Account[]); }
      });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [kind, q, region, profession, companyType]);

  return (
    <section aria-labelledby="cat-title">
      <h1 id="cat-title">{title}</h1>
      <p className="muted">{KIND_LABEL[kind]} katalogi. Faqat admin tomonidan tasdiqlangan profillar ko‘rinadi.</p>

      <div className="two" style={{ margin: '18px 0' }}>
        <div className="field">
          <label htmlFor="q">Qidirish</label>
          <input id="q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki nom bo‘yicha" />
        </div>
        <div className="field">
          <label htmlFor="reg">Viloyat</label>
          <select id="reg" className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Barcha viloyatlar</option>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name_uz}</option>)}
          </select>
        </div>
        {kind === 'mutaxassis' && (
          <div className="field">
            <label htmlFor="prof">Kasb</label>
            <select id="prof" className="select" value={profession} onChange={(e) => setProfession(e.target.value)}>
              <option value="">Barcha kasblar</option>
              {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
        {kind === 'kompaniya' && (
          <div className="field">
            <label htmlFor="ctype">Kompaniya turi</label>
            <select id="ctype" className="select" value={companyType} onChange={(e) => setCompanyType(e.target.value)}>
              <option value="">Barcha turlar</option>
              {COMPANY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      <ErrorBox error={error} />
      {!items && !error && <Loading />}
      {items && items.length === 0 && <Empty>Natija topilmadi. Filtrlarni o‘zgartirib ko‘ring.</Empty>}
      {items && items.length > 0 && (
        <div className="grid" aria-live="polite">
          {items.map((a) => (
            <a key={a.id} href={`#/${KIND_PATH[a.kind]}/${a.username}`} className="card hover">
              <div className="row">
                <Avatar name={a.display_name} src={a.avatar_url} />
                <div>
                  <h3 style={{ margin: 0 }}>{a.display_name}</h3>
                  {a.is_verified && <span className="badge ok">Verified</span>}
                </div>
              </div>
              <p className="small" style={{ marginTop: 10 }}>
                {a.kind === 'mutaxassis' ? a.professions.join(' · ') : (a.profile_data.company_type as string) || a.about?.slice(0, 90) || ''}
              </p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
