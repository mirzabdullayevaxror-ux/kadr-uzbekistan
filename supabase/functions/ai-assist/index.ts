// AI assistant (Gemini). Only logged-in users can call it.
// The API key is read from the Edge Function secret GEMINI_API_KEY and never reaches the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const MAX_INPUT = 2000;
const MAX_HISTORY = 10;

const INSTRUCTIONS: Record<string, string> = {
  profile:
    'Sen media sohasi platformasi uchun matn yordamchisisan. Quyidagi qisqa ma’lumot asosida o‘zbek tilida ' +
    'professional profil tavsifi yoz (3–5 gap). Faqat tayyor matnni qaytar, sarlavha yoki izohsiz. ' +
    'Ma’lumotda yo‘q ism, telefon, manzil yoki tajriba raqamlarini o‘ylab topma.',
  vacancy:
    'Sen media sohasi platformasi uchun matn yordamchisisan. Quyidagi qisqa ma’lumot asosida o‘zbek tilida ' +
    'aniq va jozibali vakansiya matni yoz: vazifalar, talablar va shartlar bo‘limlari bilan. ' +
    'Faqat tayyor matnni qaytar. Ma’lumotda yo‘q maosh yoki sanalarni o‘ylab topma.',
  chat:
    'Sen KADR O‘zbekiston platformasining yordamchisisan. Platforma media mutaxassislar, kompaniyalar, ' +
    'o‘quv markazlari va sotuvchilarni bog‘laydi: katalog, vakansiya, casting, ariza, taklif va support. ' +
    'Foydalanuvchi bilan o‘zbek tilida qisqa va aniq suhbatlash. Platforma qoidalari haqida bilmasang, ' +
    'taxmin qilma, buni ochiq ayt va Support’ga murojaat qilishni tavsiya qil.'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

type Turn = { role: 'user' | 'assistant'; text: string };

function parseHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_HISTORY)
    .filter((t): t is Turn => !!t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
    .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_INPUT) }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Verify the caller is a signed-in user
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Kirish talab qilinadi' }, 401);

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const task = body?.task === 'vacancy' || body?.task === 'chat' ? body.task : 'profile';
  if (!text || text.length > MAX_INPUT) {
    return json({ error: `Matn 1 dan ${MAX_INPUT} belgigacha bo‘lishi kerak` }, 400);
  }

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'AI xizmati hali sozlanmagan' }, 503);

  // Chat keeps earlier turns so the assistant can follow the conversation
  const history = task === 'chat' ? parseHistory(body?.history) : [];
  const transcript = history.map((t) => `${t.role === 'user' ? 'Foydalanuvchi' : 'Yordamchi'}: ${t.text}`).join('\n');
  const prompt = task === 'chat'
    ? `${INSTRUCTIONS.chat}\n\n${transcript ? transcript + '\n' : ''}Foydalanuvchi: ${text}\nYordamchi:`
    : `${INSTRUCTIONS[task]}\n\nMa’lumot:\n${text}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
  });
  if (!res.ok) return json({ error: 'AI xizmatida xato. Keyinroq urinib ko‘ring' }, 502);

  const out = await res.json();
  const reply: string = (out?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();
  if (!reply) return json({ error: 'AI javob bermadi. Matnni o‘zgartirib ko‘ring' }, 502);

  return json({ text: reply });
});
