// api/quota.js — остаток месячного лимита ElevenLabs (из Yeva).
// Ключ остаётся на сервере, в браузер уходят только цифры.
// GET с заголовком Authorization: Bearer <token из /api/auth>
import { checkToken } from './_token.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!checkToken(auth)) return res.status(401).json({ error: 'unauthorized', code: 'auth' });

  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY не задан в Vercel' });

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': KEY },
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'ElevenLabs ' + r.status, details: (await r.text()).slice(0, 200) });
    }
    const d = await r.json();
    const used = d.character_count || 0;
    const limit = d.character_limit || 0;
    return res.json({
      used,
      limit,
      left: Math.max(0, limit - used),
      percent: limit ? Math.round(used / limit * 100) : 0,
      tier: d.tier || '—',
      resetUnix: d.next_character_count_reset_unix || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
