import { useEffect, useState } from 'react';
import { supabase, ACCOUNT_COLS } from '../lib/supabase';
import type { Account } from '../lib/auth';
import { useAuth } from '../lib/auth';
import type { AccountKind } from '../lib/constants';
import { KIND_LABEL, KIND_PATH, EMPLOYMENT } from '../lib/constants';
import { Avatar, ErrorBox, Loading, errMsg, fmtDate } from '../components/ui';
import { back, go } from '../lib/router';

interface Contact { phone: string | null; email: string | null; telegram: string | null; public_age: number | null }

// Public profile. Contacts come from an RPC that applies the owner's visibility toggles.
export function Profile({ kind, username }: { kind: AccountKind; username: string }) {
  const { user, accounts } = useAuth();
  const [acc, setAcc] = useState<Account | null | undefined>(undefined);
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setAcc(undefined);
    supabase.from('accounts').select(ACCOUNT_COLS).eq('username', username).eq('kind', kind).maybeSingle()
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error) { setError(errMsg(error)); return; }
        const row = (data ?? null) as unknown as Account | null;
        setAcc(row);
        if (row && row.status === 'approved') {
          const { data: c } = await supabase.rpc('get_public_contact', { p_account: row.id });
          if (alive) setContact(((c as Contact[]) ?? [])[0] ?? null);
        }
      });
    return () => { alive = false; };
  }, [kind, username]);

  if (error) return <ErrorBox error={error} />;
  if (acc === undefined) return <Loading />;
  if (acc === null) {
    return (
      <div className="empty">
        <h2>Profil topilmadi</h2>
        <p>Bu profil mavjud emas yoki hali tasdiqlanmagan.</p>
        <a className="btn" href="#/">Bosh sahifaga</a>
      </div>
    );
  }

  const isOwner = !!user && accounts.some((a) => a.id === acc.id);
  const profileData = acc.profile_data as Record<string, string | string[] | undefined>;

  return (
    <article aria-labelledby="p-title">
      <button className="btn sm ghost" onClick={() => back(`/${KIND_PATH[kind]}`)} style={{ marginBottom: 14 }}>← Orqaga</button>

      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row">
            <Avatar name={acc.display_name} src={acc.avatar_url} />
            <div>
              <h1 id="p-title" style={{ fontSize: 28, margin: 0 }}>{acc.display_name}</h1>
              <p className="small" style={{ margin: '4px 0 0' }}>
                {KIND_LABEL[acc.kind]} · @{acc.username}
                {acc.is_verified && <span className="badge ok" style={{ marginLeft: 8 }}>Verified</span>}
                {acc.pro_tier !== 'FREE' && <span className="badge warn" style={{ marginLeft: 8 }}>{acc.pro_tier}</span>}
              </p>
            </div>
          </div>
          {isOwner && <button className="btn sm" onClick={() => go(`/edit/${acc.id}`)}>Tahrirlash</button>}
        </div>

        {acc.professions.length > 0 && (
          <div className="chips" style={{ marginTop: 16 }}>
            {acc.professions.map((p) => <span key={p} className="chip on">{p}</span>)}
          </div>
        )}
        {acc.about && <p style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{acc.about}</p>}

        <dl className="two small" style={{ marginTop: 16 }}>
          {acc.city || acc.region_code ? <div><dt className="muted">Joylashuv</dt><dd style={{ margin: 0 }}>{acc.city ?? acc.region_code}</dd></div> : null}
          {contact?.public_age != null && <div><dt className="muted">Yosh</dt><dd style={{ margin: 0 }}>{contact.public_age}</dd></div>}
          {profileData.company_type && <div><dt className="muted">Turi</dt><dd style={{ margin: 0 }}>{String(profileData.company_type)}</dd></div>}
          {profileData.availability && <div><dt className="muted">Bandlik</dt><dd style={{ margin: 0 }}>{String(profileData.availability)}</dd></div>}
          {profileData.employment && <div><dt className="muted">Ish turi</dt><dd style={{ margin: 0 }}>{EMPLOYMENT[String(profileData.employment)] ?? String(profileData.employment)}</dd></div>}
          <div><dt className="muted">Ro‘yxatdan o‘tgan</dt><dd style={{ margin: 0 }}>{fmtDate(acc.created_at)}</dd></div>
        </dl>

        <div className="row" style={{ marginTop: 18 }}>
          {contact?.phone && <a className="btn sm" href={`tel:${contact.phone}`}>Qo‘ng‘iroq</a>}
          {contact?.telegram && <a className="btn sm" href={`https://t.me/${contact.telegram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">Telegram</a>}
          {contact?.email && <a className="btn sm" href={`mailto:${contact.email}`}>Email</a>}
          {acc.instagram && <a className="btn sm" href={`https://instagram.com/${acc.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">Instagram</a>}
          {user && !isOwner && (
            <ChatButton fromAccount={accounts[0]?.id} toAccount={acc.id} />
          )}
          {!user && <a className="btn sm primary" href="#/login">Yozish uchun kiring</a>}
        </div>
      </div>
    </article>
  );
}

function ChatButton({ fromAccount, toAccount }: { fromAccount?: string; toAccount: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!fromAccount) {
    return <a className="btn sm" href="#/onboarding/mijoz">Chat uchun akkaunt yarating</a>;
  }
  return (
    <>
      <button className="btn sm primary" disabled={busy} onClick={async () => {
        setBusy(true); setErr(null);
        const { data, error } = await supabase.rpc('start_conversation', { p_from: fromAccount, p_to: toAccount });
        setBusy(false);
        if (error) setErr(errMsg(error)); else go(`/chat/${data}`);
      }}>Yozish</button>
      <ErrorBox error={err} />
    </>
  );
}
