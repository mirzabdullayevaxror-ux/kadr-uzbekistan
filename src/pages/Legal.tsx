import { back } from '../lib/router';

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Foydalanish shartlari',
    body: [
      'KADR platformasi media mutaxassislar, mijozlar, kompaniyalar, o‘quv markazlari va sotuvchilar uchun ekotizim hisoblanadi.',
      'Profilga kiritilgan ma’lumotlar to‘g‘ri bo‘lishi shart. Soxta ma’lumot uchun akkaunt bloklanishi mumkin.',
      'Mutaxassis, kompaniya, sotuvchi va o‘quv markazi akkauntlari admin tasdig‘idan so‘ng ommaga ko‘rinadi.',
      'Verified belgisi sotilmaydi; u faqat identifikatsiya/biznes tekshiruvidan so‘ng beriladi.'
    ]
  },
  privacy: {
    title: 'Maxfiylik siyosati',
    body: [
      'Tug‘ilgan sana faqat hisoblangan yosh ko‘rinishida ommaga chiqadi. Hujjatlar va aloqa ma’lumotlari ochiq saqlanmaydi.',
      'Telefon, email va Telegram faqat foydalanuvchi ruxsat bergan hollarda profilda ko‘rinadi.',
      'Akkauntni o‘chirish so‘rovi support orqali beriladi.'
    ]
  }
};

export function Legal({ doc }: { doc: string }) {
  const d = DOCS[doc];
  if (!d) return <div className="empty">Hujjat topilmadi.</div>;
  return (
    <article style={{ maxWidth: 760 }}>
      <button className="btn sm ghost" onClick={() => back('/')}>← Orqaga</button>
      <h1 style={{ marginTop: 14 }}>{d.title}</h1>
      <div className="notice small">Bu matn taqdimot uchun. Yakuniy huquqiy matn O‘zbekiston yuristi tomonidan tekshirilishi kerak.</div>
      {d.body.map((p, i) => <p key={i}>{p}</p>)}
    </article>
  );
}
