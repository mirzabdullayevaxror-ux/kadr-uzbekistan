// AI writing assistant (Claude). Only logged-in users can call it.
// The API key is read from the Edge Function secret ANTHROPIC_API_KEY and never reaches the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
const MAX_INPUT = 2000;

const INSTRUCTIONS: Record<string, string> = {
  profile:
    'Sen media sohasi platformasi uchun matn yordamchisisan. Quyidagi qisqa ma’lumot asosida o‘zbek tilida ' +
    'professional profil tavsifi yoz (3–5 gap). Faqat tayyor matnni qaytar, sarlavha yoki izohsiz. ' +
    'Ma’lumotda yo‘q ism, telefon, manzil yoki tajriba raqamlarini o‘ylab topma.',
  vacancy:
    'Sen media sohasi platformasi uchun matn yordamchisisan. Quyidagi qisqa ma’lumot asosida o‘zbek tilida ' +
    'aniq va jozibali vakansiya matni yoz: vazifalar, talablar va shartlar bo‘limlari bilan. ' +
    'Faqat tayyor matnni qaytar. Ma’lumotda yo‘q maosh yoki sanalarni o‘ylab topma.'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
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
  const task = body?.task === 'vacancy' ? 'vacancy' : 'profile';
  if (!text || text.length > MAX_INPUT) {
    return json({ error: `Matn 1 dan ${MAX_INPUT} belgigacha bo‘lishi kerak` }, 400);
  }

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'AI xizmati hali sozlanmagan' }, 503);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: `${INSTRUCTIONS[task]}\n\nMa’lumot:\n${text}` }]
    })
  });
  if (!res.ok) return json({ error: 'AI xizmatida xato. Keyinroq urinib ko‘ring' }, 502);

  const out = await res.json();
  const reply: string = (out?.content ?? [])
    .map((p: { type?: string; text?: string }) => (p.type === 'text' ? p.text ?? '' : ''))
    .join('')
    .trim();
  if (!reply) return json({ error: 'AI javob bermadi. Matnni o‘zgartirib ko‘ring' }, 502);

  return json({ text: reply });
});
