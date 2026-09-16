import { checkToken, checkPassword, delay } from './_token.js';

const MAX_BYTES = 100 * 1024;
const HEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

// Проверяем формат, чтобы в settings.json не попал мусор, ломающий часы
function validate(s) {
    if (!s || typeof s !== 'object') return 'Нет данных';
    const { CLOCK_TEXTS, ARC } = s;
    if (!Array.isArray(CLOCK_TEXTS) || CLOCK_TEXTS.length > 60) return 'CLOCK_TEXTS: неверный формат';
    for (const cfg of CLOCK_TEXTS) {
        if (!cfg || !Number.isFinite(cfg.textHour) || !Number.isFinite(cfg.radius_k)) return 'Надпись: неверные числа';
        if (!Array.isArray(cfg.lines) || !cfg.lines.length) return 'Надпись без строк';
        for (const line of cfg.lines) {
            if (!Array.isArray(line) || !line.length) return 'Пустая строка надписи';
            for (const w of line) {
                if (!w || typeof w.t !== 'string' || w.t.length > 100 || !HEX.test(w.c)) return 'Слово: неверный текст или цвет';
            }
        }
    }
    if (!ARC || typeof ARC !== 'object') return 'ARC: неверный формат';
    for (const k of ['lineWidth', 'arrowSize', 'radiusExtra']) {
        if (!Number.isFinite(ARC[k])) return 'ARC.' + k + ': не число';
    }
    if (!HEX.test(ARC.colorRight) || !HEX.test(ARC.colorLeft)) return 'ARC: неверный цвет';
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    // CORS не нужен: редактор на том же домене, запись с чужих сайтов не разрешаем
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const { token, password, settings, sha } = req.body || {};

    // Основной путь — токен из /api/auth; пароль оставлен для совместимости
    if (!checkToken(token) && !checkPassword(password)) {
        await delay(800);
        return res.status(401).json({ ok: false, code: 'auth', error: 'Сессия истекла — войдите снова' });
    }

    const invalid = validate(settings);
    if (invalid) return res.status(400).json({ ok: false, error: invalid });

    const json = JSON.stringify(settings, null, 2);
    if (Buffer.byteLength(json) > MAX_BYTES) {
        return res.status(413).json({ ok: false, error: 'Слишком большой файл настроек' });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo  = process.env.GITHUB_REPO;
    const path  = process.env.GITHUB_SETTINGS_PATH || 'settings.json';
    const ghTok = process.env.GITHUB_TOKEN;
    if (!owner || !repo || !ghTok) {
        return res.status(500).json({ ok: false, error: 'Не заданы GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN' });
    }

    const body = {
        message: 'Update clock settings via editor',
        content: Buffer.from(json).toString('base64'),
        ...(sha ? { sha } : {}),  // sha нужен, если файл уже существует
    };

    try {
        const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `token ${ghTok}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'uhrzeit-app',
                },
                body: JSON.stringify(body),
            }
        );

        if (r.status === 409 || r.status === 422) {
            // Файл изменился с момента загрузки (другая вкладка/устройство)
            return res.status(409).json({ ok: false, code: 'conflict', error: 'Настройки изменены в другом месте — перезагрузите редактор' });
        }
        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            return res.status(502).json({ ok: false, error: err.message || ('GitHub ' + r.status) });
        }

        const data = await r.json();
        return res.status(200).json({ ok: true, sha: data.content.sha });

    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
