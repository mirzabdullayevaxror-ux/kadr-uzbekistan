import { useState } from 'react';

// Offline decision-tree helper: no network calls, no API key.
// The user answers with buttons; each answer moves to the next node until a solution is shown.
type Action = { label: string; href: string };
type Node =
  | { q: string; options: { label: string; next: string }[] }
  | { title: string; text: string; actions?: Action[] };

const TREE: Record<string, Node> = {
  root: {
    q: 'Nima bilan yordam kerak?',
    options: [
      { label: 'Rol tanlash', next: 'role' },
      { label: 'Akkaunt holati', next: 'account' },
      { label: 'Ariza', next: 'application' },
      { label: 'Kirish muammosi', next: 'login' },
      { label: 'Boshqa', next: 'other' }
    ]
  },
  role: {
    q: 'Siz kim sifatida qatnashmoqchisiz?',
    options: [
      { label: 'Ish qidiruvchi mutaxassis', next: 'r_talent' },
      { label: 'Studiya yoki kompaniya', next: 'r_company' },
      { label: 'O‘quv markazi', next: 'r_center' },
      { label: 'Asbob-uskuna sotuvchi', next: 'r_shop' },
      { label: 'Faqat ko‘rmoqchiman', next: 'r_client' }
    ]
  },
  r_talent: {
    title: 'Mutaxassis roli',
    text: 'Portfolio va tajribangizni ko‘rsatish uchun “Mutaxassis” rolini tanlang. Ariza yuborish va vakansiyalarni ko‘rish imkoniyati ham shu rol bilan ochiladi.',
    actions: [{ label: 'Ro‘yxatdan o‘tish', href: '#/onboarding/mutaxassis' }]
  },
  r_company: {
    title: 'Kompaniya roli',
    text: 'Studiya yoki kompaniyangiz nomidan vakansiya e’lon qilish va mutaxassislarni qidirish uchun “Kompaniya” rolini tanlang.',
    actions: [{ label: 'Ro‘yxatdan o‘tish', href: '#/onboarding/kompaniya' }]
  },
  r_center: {
    title: 'O‘quv markazi roli',
    text: 'Kurslaringiz va o‘quv markazingizni e’lon qilish uchun “O‘quv markazi” rolini tanlang.',
    actions: [{ label: 'Ro‘yxatdan o‘tish', href: '#/onboarding/oquv_markazi' }]
  },
  r_shop: {
    title: 'Sotuvchi roli',
    text: 'Asbob-uskunalarni sotish uchun “Sotuvchi” rolini tanlang.',
    actions: [{ label: 'Ro‘yxatdan o‘tish', href: '#/onboarding/sotuvchi' }]
  },
  r_client: {
    title: 'Mijoz roli',
    text: 'Katalogni ko‘rish va xizmat buyurtma qilish uchun “Mijoz” roli mos keladi.',
    actions: [{ label: 'Ro‘yxatdan o‘tish', href: '#/onboarding' }]
  },
  account: {
    q: 'Akkauntingiz holati qanday ko‘rinadi?',
    options: [
      { label: 'Qoralama (tugallanmagan)', next: 'a_draft' },
      { label: 'Yuborilgan, kutilmoqda', next: 'a_wait' },
      { label: 'Rad etilgan', next: 'a_rejected' },
      { label: 'Qo‘shimcha ma’lumot so‘ralgan', next: 'a_needs' }
    ]
  },
  a_draft: {
    title: 'Akkaunt hali yuborilmagan',
    text: 'Profilingizdagi majburiy maydonlarni to‘ldiring va “Yuborish” tugmasini bosing. Yuborilgandan keyin moderatsiya ko‘rib chiqadi.',
    actions: [{ label: 'Kabinetga o‘tish', href: '#/dashboard' }]
  },
  a_wait: {
    title: 'Moderatsiya kutilmoqda',
    text: 'Akkauntingiz ko‘rib chiqilmoqda. Holat o‘zgarganda bildirishnoma keladi (qo‘ng‘iroq belgisi). Uzoq vaqt o‘zgarmasa, Support’ga yozing.',
    actions: [{ label: 'Support', href: '#/support' }]
  },
  a_rejected: {
    title: 'Akkaunt rad etilgan',
    text: 'Rad etish sababi bildirishnomada va kabinetingizda ko‘rsatilgan. Sababni tuzatib, akkauntni qayta yuboring.',
    actions: [{ label: 'Kabinetga o‘tish', href: '#/dashboard' }, { label: 'Support', href: '#/support' }]
  },
  a_needs: {
    title: 'Qo‘shimcha ma’lumot kerak',
    text: 'Moderatorlar so‘ragan ma’lumotni profilingizga qo‘shing va qayta yuboring. So‘rov matni bildirishnomada ko‘rsatilgan.',
    actions: [{ label: 'Profilni tahrirlash', href: '#/dashboard' }]
  },
  application: {
    q: 'Ariza bo‘yicha nima savol?',
    options: [
      { label: 'Ariza holati nimani anglatadi?', next: 'app_status' },
      { label: 'Ariza yuborish imkoni yo‘q', next: 'app_send' }
    ]
  },
  app_status: {
    title: 'Ariza holatlari',
    text: '• Kutilmoqda: ariza qabul qilindi.\n• Shortlist: ariza saralangan ro‘yxatga kiritilgan.\n• Qabul qilindi: ish beruvchi arizani ma’qulladi.\n• Rad etildi: ariza bu safar mos kelmadi.',
    actions: [{ label: 'Kirish xabarlari', href: '#/inbox' }]
  },
  app_send: {
    title: 'Ariza yuborish',
    text: 'Vakansiya sahifasida “Ariza yuborish” tugmasi ishlamasa, avval akkauntingiz to‘liq to‘ldirilganini va tasdiqlanganini tekshiring. Muammo davom etsa, Support’ga yozing.',
    actions: [{ label: 'Vakansiyalar', href: '#/vacancies' }, { label: 'Support', href: '#/support' }]
  },
  login: {
    q: 'Kirishda qanday muammo bor?',
    options: [
      { label: 'Parol yoki email xato deyapti', next: 'l_creds' },
      { label: 'Akkaunt bloklangan deyapti', next: 'l_banned' }
    ]
  },
  l_creds: {
    title: 'Kirish ma’lumotlari',
    text: 'Email va parolni tekshirib qayta urinib ko‘ring. Google orqali kirgan bo‘lsangiz, o‘sha Google hisobi bilan kiring. Hal bo‘lmasa, Support’ga yozing.',
    actions: [{ label: 'Kirish', href: '#/login' }, { label: 'Support', href: '#/support' }]
  },
  l_banned: {
    title: 'Akkaunt bloklangan',
    text: 'Bloklash sababi haqida Support orqali so‘rang. Bloklangan akkauntda platformadan foydalanish cheklangan, lekin Support ochiq.',
    actions: [{ label: 'Support', href: '#/support' }]
  },
  other: {
    title: 'Boshqa savol',
    text: 'Savolingizni Support’ga yozing, jamoa javob beradi.',
    actions: [{ label: 'Support', href: '#/support' }]
  }
};

export function DecisionHelper() {
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<string[]>(['root']);
  const current = TREE[trail[trail.length - 1]];

  const go = (next: string) => setTrail((t) => [...t, next]);
  const back = () => setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));
  const restart = () => setTrail(['root']);

  return (
    <>
      <button
        className="btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="decision-helper"
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 50, borderRadius: 999, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}
      >
        {open ? 'Yopish' : 'Yordamchi'}
      </button>

      {open && (
        <div
          id="decision-helper"
          role="dialog"
          aria-label="Yordamchi"
          className="card"
          style={{ position: 'fixed', right: 16, bottom: 68, zIndex: 50, width: 'min(340px, calc(100vw - 32px))', maxHeight: '70vh', overflowY: 'auto', padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }}
        >
          {'q' in current ? (
            <>
              <strong style={{ display: 'block', marginBottom: 10 }}>{current.q}</strong>
              <div className="stack" style={{ gap: 6 }}>
                {current.options.map((o) => (
                  <button key={o.label} className="btn sm" style={{ textAlign: 'left' }} onClick={() => go(o.next)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <strong style={{ display: 'block', marginBottom: 6 }}>{current.title}</strong>
              <p className="small" style={{ whiteSpace: 'pre-line', margin: '0 0 12px' }}>{current.text}</p>
              {current.actions && (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {current.actions.map((a) => (
                    <a key={a.href} className="btn sm" href={a.href} onClick={() => setOpen(false)}>{a.label}</a>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="row between" style={{ marginTop: 12 }}>
            <button className="btn sm ghost" onClick={back} disabled={trail.length === 1}>Orqaga</button>
            <button className="btn sm ghost" onClick={restart}>Boshidan</button>
          </div>
        </div>
      )}
    </>
  );
}
