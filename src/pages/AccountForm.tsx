import { useEffect, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import type { Account } from '../lib/auth';
import { useAuth } from '../lib/auth';
import { KIND_LABEL, NEEDS_APPROVAL, PROFESSIONS, COMPANY_TYPES, type AccountKind } from '../lib/constants';
import { ErrorBox, Loading, errMsg } from '../components/ui';
import { go } from '../lib/router';
import { useRegions } from '../lib/regions';
import { AiAssist } from '../components/AiAssist';

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,39}$/;
const PHONE_RE = /^\+998\d{9}$/;

interface Form {
  username: string; display_name: string; about: string; region_code: string; city: string; address: string;
  instagram: string; website: string; professions: string[]; company_type: string; availability: string;
  phone: string; email: string; telegram: string; birth_date: string;
  vis_phone: boolean; vis_email: boolean; vis_telegram: boolean;
}

const EMPTY: Form = {
  username: '', display_name: '', about: '', region_code: '', city: '', address: '', instagram: '', website: '',
  professions: [], company_type: '', availability: 'ready', phone: '', email: '', telegram: '', birth_date: '',
  vis_phone: false, vis_email: false, vis_telegram: true
};

// One form for all 5 account types. Create (kind) and edit (editId) share the same fields.
export function AccountForm({ kind, editId }: { kind?: string; editId?: string }) {
  const { user, refresh } = useAuth();
  const regions = useRegions();
  const [k, setK] = useState<AccountKind | null>((kind as AccountKind) ?? null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(!editId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data: a, error: e1 } = await supabase.from('accounts').select(ACCOUNT_COLS).eq('id', editId).maybeSingle();
      if (e1 || !a) { setError(e1 ? errMsg(e1) : 'Akkaunt topilmadi'); return; }
      const acc = a as unknown as Account;
      const { data: c } = await supabase.from('account_contacts').select('phone,email,telegram,birth_date,contact_visibility').eq('account_id', editId).maybeSingle();
      const cv = (c?.contact_visibility ?? {}) as Record<string, boolean>;
      setK(acc.kind);
      setForm({
        ...EMPTY,
        username: acc.username, display_name: acc.display_name, about: acc.about ?? '', region_code: acc.region_code ?? '',
        city: acc.city ?? '', address: acc.address ?? '', instagram: acc.instagram ?? '', website: acc.website ?? '',
        professions: acc.professions, company_type: String(acc.profile_data.company_type ?? ''),
        availability: String(acc.profile_data.availability ?? 'ready'),
        phone: c?.phone ?? '', email: c?.email ?? '', telegram: c?.telegram ?? '', birth_date: c?.birth_date ?? '',
        vis_phone: !!cv.phone, vis_email: !!cv.email, vis_telegram: cv.telegram !== false
      });
      setLoaded(true);
    })();
  }, [editId]);

  if (!user) return null;

  if (!k) {
    return (
      <div>
        <h1>Rolingizni tanlang</h1>
        <p className="muted">Har bir rol uchun alohida akkaunt va katalog bor. Keyinroq yana rol qo‘shishingiz mumkin.</p>
        <div className="grid">
          {(['mijoz', 'mutaxassis', 'kompaniya', 'sotuvchi', 'oquv_markazi'] as AccountKind[]).map((r) => (
            <button key={r} className="card hover" style={{ textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
              onClick={() => go(`/onboarding/${r}`)}>
              <h3>{KIND_LABEL[r]}</h3>
              <p className="small">{NEEDS_APPROVAL[r] ? 'Admin tasdig‘i kerak' : 'Tasdiqsiz, darhol faol'}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!loaded) return <Loading />;

  const set = <K extends keyof Form>(key: K, val: Form[K]) => setForm((f) => ({ ...f, [key]: val }));
  const toggleProf = (p: string) => set('professions', form.professions.includes(p) ? form.professions.filter((x) => x !== p) : [...form.professions, p]);

  const validate = (): string | null => {
    if (!USERNAME_RE.test(form.username)) return 'Username: 3–40 belgi, faqat kichik harf, raqam, _ va -';
    if (form.display_name.trim().length < 2) return 'Ism/nom kamida 2 belgi bo‘lsin';
    if (k === 'mutaxassis' && form.professions.length === 0) return 'Kamida bitta kasbni tanlang';
    if (k === 'kompaniya' && !form.company_type) return 'Kompaniya turini tanlang';
    if (form.phone && !PHONE_RE.test(form.phone)) return 'Telefon formati: +998901234567';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return 'Email noto‘g‘ri';
    if (k === 'mutaxassis' && form.birth_date && new Date(form.birth_date) > new Date()) return 'Tug‘ilgan sana kelajakda bo‘lishi mumkin emas';
    return null;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setBusy(true); setError(null); setDone(null);

    const accountFields = {
      username: form.username, display_name: form.display_name.trim(), about: form.about.trim() || null,
      region_code: form.region_code || null, city: form.city.trim() || null, address: form.address.trim() || null,
      instagram: form.instagram.trim() || null, website: form.website.trim() || null,
      professions: k === 'mutaxassis' ? form.professions : [],
      profile_data: {
        ...(k === 'kompaniya' ? { company_type: form.company_type } : {}),
        ...(k === 'mutaxassis' ? { availability: form.availability } : {})
      }
    };
    const contactFields = {
      phone: form.phone || null, email: form.email || null, telegram: form.telegram.replace(/^@/, '') || null,
      birth_date: k === 'mutaxassis' && form.birth_date ? form.birth_date : null,
      contact_visibility: { phone: form.vis_phone, email: form.vis_email, telegram: form.vis_telegram }
    };

    let accountId = editId;
    if (!editId) {
      // Insert without returning representation: private columns are not readable by the client.
      const { error: insErr } = await supabase.from('accounts').insert({ owner_id: user.id, kind: k, ...accountFields });
      if (insErr) { setBusy(false); setError(insErr.code === '23505' ? 'Bu username band' : errMsg(insErr)); return; }
      const { data: mine } = await supabase.from('accounts').select('id').eq('owner_id', user.id).eq('kind', k).maybeSingle();
      accountId = mine?.id;
    } else {
      const { error: updErr } = await supabase.from('accounts').update(accountFields).eq('id', editId);
      if (updErr) { setBusy(false); setError(updErr.code === '23505' ? 'Bu username band' : errMsg(updErr)); return; }
    }
    if (!accountId) { setBusy(false); setError('Akkaunt saqlanmadi'); return; }

    const { error: cErr } = await supabase.from('account_contacts').update(contactFields).eq('account_id', accountId);
    if (cErr) { setBusy(false); setError(errMsg(cErr)); return; }

    if (!editId && NEEDS_APPROVAL[k]) {
      const { error: sErr } = await supabase.rpc('submit_account', { p_account: accountId });
      if (sErr) { setBusy(false); setError(errMsg(sErr)); return; }
    }
    await refresh();
    setBusy(false);
    if (!editId && NEEDS_APPROVAL[k]) {
      setDone('Akkaunt saqlandi va admin tekshiruviga yuborildi. Tasdiqlangach katalogda ko‘rinadi.');
    } else {
      setDone('Saqlandi.');
    }
    if (!editId) setTimeout(() => go('/dashboard'), 900);
  };

  return (
    <form onSubmit={save} noValidate aria-labelledby="af-title">
      <h1 id="af-title">{editId ? 'Profilni tahrirlash' : `${KIND_LABEL[k]} akkaunti`}</h1>
      {!editId && NEEDS_APPROVAL[k] && <p className="muted">Saqlangach akkaunt admin tomonidan tekshiriladi.</p>}

      <div className="card stack">
        <div className="two">
          <div className="field"><label htmlFor="un">Username (URL uchun)</label>
            <input id="un" className="input" value={form.username} onChange={(e) => set('username', e.target.value.toLowerCase())} required /></div>
          <div className="field"><label htmlFor="dn">{k === 'kompaniya' || k === 'oquv_markazi' || k === 'sotuvchi' ? 'Nom' : 'Ism / taxallus'}</label>
            <input id="dn" className="input" value={form.display_name} onChange={(e) => set('display_name', e.target.value)} required /></div>
        </div>

        {k === 'mutaxassis' && (
          <>
            <div className="field"><span className="small muted" style={{ fontWeight: 600 }}>Kasblar (bir nechta tanlash mumkin)</span>
              <div className="chips" role="group" aria-label="Kasblar">
                {PROFESSIONS.map((p) => (
                  <button type="button" key={p} className={`chip ${form.professions.includes(p) ? 'on' : ''}`} aria-pressed={form.professions.includes(p)} onClick={() => toggleProf(p)}>{p}</button>
                ))}
              </div>
            </div>
            <div className="two">
              <div className="field"><label htmlFor="av">Bandlik</label>
                <select id="av" className="select" value={form.availability} onChange={(e) => set('availability', e.target.value)}>
                  <option value="ready">Ishlashga tayyor</option><option value="busy">Band</option><option value="unavailable">Vaqtincha ishlamaydi</option>
                </select></div>
              <div className="field"><label htmlFor="bd">Tug‘ilgan sana (shaxsiy, faqat yosh ko‘rsatiladi)</label>
                <input id="bd" type="date" className="input" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} /></div>
            </div>
          </>
        )}

        {k === 'kompaniya' && (
          <div className="field"><label htmlFor="ct">Kompaniya turi</label>
            <select id="ct" className="select" value={form.company_type} onChange={(e) => set('company_type', e.target.value)} required>
              <option value="">Tanlang</option>{COMPANY_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
        )}

        <div className="two">
          <div className="field"><label htmlFor="rg">Viloyat</label>
            <select id="rg" className="select" value={form.region_code} onChange={(e) => set('region_code', e.target.value)}>
              <option value="">Tanlang</option>{regions.map((r) => <option key={r.code} value={r.code}>{r.name_uz}</option>)}
            </select></div>
          <div className="field"><label htmlFor="ci">Shahar / tuman</label>
            <input id="ci" className="input" value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
        </div>

        <div className="field"><label htmlFor="ab">Haqida</label>
          <textarea id="ab" className="textarea" maxLength={4000} value={form.about} onChange={(e) => set('about', e.target.value)} />
          <AiAssist task="profile" onResult={(t) => set('about', t.slice(0, 4000))} /></div>

        <div className="two">
          <div className="field"><label htmlFor="ph">Telefon</label>
            <input id="ph" className="input" placeholder="+998901234567" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\s/g, ''))} />
            <label className="row small"><input type="checkbox" checked={form.vis_phone} onChange={(e) => set('vis_phone', e.target.checked)} /> Profilda ko‘rsatish</label></div>
          <div className="field"><label htmlFor="em">Email</label>
            <input id="em" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <label className="row small"><input type="checkbox" checked={form.vis_email} onChange={(e) => set('vis_email', e.target.checked)} /> Profilda ko‘rsatish</label></div>
        </div>
        <div className="two">
          <div className="field"><label htmlFor="tg">Telegram username</label>
            <input id="tg" className="input" placeholder="@username" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} />
            <label className="row small"><input type="checkbox" checked={form.vis_telegram} onChange={(e) => set('vis_telegram', e.target.checked)} /> Profilda ko‘rsatish</label></div>
          <div className="field"><label htmlFor="ig">Instagram</label>
            <input id="ig" className="input" placeholder="@username" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="ws">Veb-sayt</label>
          <input id="ws" className="input" placeholder="https://" value={form.website} onChange={(e) => set('website', e.target.value)} /></div>

        <ErrorBox error={error} />
        {done && <div className="notice ok" role="status">{done}</div>}
        <div className="row">
          <button className="btn primary" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
          <a className="btn ghost" href="#/dashboard">Bekor qilish</a>
        </div>
      </div>
    </form>
  );
}
