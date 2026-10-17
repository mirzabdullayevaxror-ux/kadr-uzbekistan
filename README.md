# KADR O‘zbekiston

Media mutaxassislar, kompaniyalar, o‘quv markazlari, vakansiya va casting platformasi.

- Frontend: Vite + React + TypeScript (hash routing, `#/talent/<username>`)
- Backend: Supabase (PostgreSQL, Auth, RLS). Migratsiyalar: `supabase/migrations/`
- Deploy: GitHub Pages (`.github/workflows/pages.yml`)

## Lokal ishga tushirish

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY ni kiriting
npm run dev
```

## Admin yaratish

Admin rol bazada qo‘lda beriladi (klientdan admin yaratib bo‘lmaydi):

```sql
insert into public.user_roles (user_id, role) values ('<auth.users.id>', 'admin');
```

## Xavfsizlik qoidalari

- Holat (`status`), `is_verified`, `pro_tier` faqat admin RPC orqali o‘zgaradi (`admin_review_*`).
- Shaxsiy ma’lumotlar (telefon, email, Telegram, tug‘ilgan sana) `account_contacts` jadvalida; ommaga faqat `get_public_contact()` orqali va foydalanuvchi ruxsati bilan.
- Service role kaliti hech qachon frontend yoki repoga qo‘yilmaydi.
