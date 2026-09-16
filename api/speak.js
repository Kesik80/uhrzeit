// api/speak.js — озвучка фразы через ElevenLabs (основа — speak.js из Yeva).
// Только генерация: звук возвращается в браузер (base64), запись в GitHub — через /api/commit.
//
// POST { token, text, voiceId, modelId, voiceSettings, previousText, nextText }
//   token         — из /api/auth (пароль редактора)
//   modelId       — из белого списка, включая eleven_v3
//   voiceSettings — { stability, similarity_boost, style, speed, use_speaker_boost }
//   previousText / nextText — невидимый контекст интонации (у v3 не поддерживается, не отправляем)
//
// Env: ELEVENLABS_API_KEY, EDITOR_PASSWORD
import { checkToken, delay } from './_token.js';

export const config = { maxDuration: 30 };

const ALLOWED_VOICES = {
  'CwhRBWXzGAHq8TQ4Fs17': 'Roger',
  'FGY2WhTYpPnrIDTdsKH5': 'Laura',
  'TX3LPaxmHKxFdv7VOQHJ': 'Liam',
  'XrExE9yKIg1WjnnlVkGX': 'Matilda',
  'bIHbv24MWmeRgasZH58o': 'Will',
  'cgSgspJ2msm6clMCkdW9': 'Jessica',
  'cjVigY5qzO86Huf0OWal': 'Eric',
  'nPczCjzI2devNBz1zQrb': 'Brian',
  'onwK4e9ZLuTAKqWW03F9': 'Daniel',
  'pFZP5JQG7iQjIQuC4Bku': 'Lily',
  'pqHfZKP75CvOlQylNhV4': 'Bill',
};
const DEFAULT_VOICE = 'CwhRBWXzGAHq8TQ4Fs17';

const ALLOWED_MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_v3'];

// 64 кбит/с моно — речь звучит чисто, а 144 файла весят ~2–3 МБ, а не 5+
const OUTPUT_FORMAT = 'mp3_44100_64';

const num = (v, min, max, dflt) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { token, text, voiceId, modelId, voiceSettings, previousText, nextText } = req.body || {};

  if (!checkToken(token)) {
    await delay(500);
    return res.status(401).json({ error: 'Сессия истекла — войдите снова', code: 'auth' });
  }
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text required' });
  if (text.length > 300) return res.status(400).json({ error: 'text too long' });

  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY не задан в Vercel' });

  const voice = ALLOWED_VOICES[voiceId] ? voiceId : DEFAULT_VOICE;
  const model = ALLOWED_MODELS.includes(modelId) ? modelId : 'eleven_multilingual_v2';
  const isV3 = model === 'eleven_v3';

  const vs = voiceSettings || {};
  let stability = num(vs.stability, 0, 1, 0.5);
  // v3 принимает только 0 / 0.5 / 1 (Creative / Natural / Robust)
  if (isV3) stability = stability < 0.25 ? 0 : stability > 0.75 ? 1 : 0.5;

  const settings = {
    stability,
    similarity_boost: num(vs.similarity_boost, 0, 1, 0.75),
    style: num(vs.style, 0, 1, 0),
    use_speaker_boost: vs.use_speaker_boost !== false,
  };
  const speed = num(vs.speed, 0.7, 1.2, 1);
  if (speed !== 1) settings.speed = speed;

  const body = { text, model_id: model, voice_settings: settings };
  if (!isV3) {
    if (previousText) body.previous_text = String(previousText).slice(0, 400);
    if (nextText) body.next_text = String(nextText).slice(0, 400);
  }

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${OUTPUT_FORMAT}`,
      {
        method: 'POST',
        headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': KEY },
        body: JSON.stringify(body),
      }
    );
    if (!r.ok) {
      const details = (await r.text()).slice(0, 400);
      return res.status(502).json({ error: 'ElevenLabs ' + r.status, details });
    }
    const audio = Buffer.from(await r.arrayBuffer()).toString('base64');
    return res.json({ audio, voice: ALLOWED_VOICES[voice], model, stability });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
