export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const owner = process.env.GITHUB_OWNER;
    const repo  = process.env.GITHUB_REPO;
    const path  = process.env.GITHUB_SETTINGS_PATH || 'settings.json';
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
        return res.status(500).json({ ok: false, error: 'Не заданы GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN' });
    }

    // Часы: короткий CDN-кэш (меньше запросов к GitHub, быстрее старт).
    // Редактор: ?fresh=1 — всегда свежие данные и актуальный sha, иначе сохранение упадёт с конфликтом.
    const fresh = req.query && req.query.fresh;
    res.setHeader('Cache-Control', fresh ? 'no-store' : 's-maxage=30, stale-while-revalidate=300');

    try {
        const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
            {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'User-Agent': 'uhrzeit-app',
                },
            }
        );

        if (r.status === 404) {
            // Файл ещё не создан
            return res.status(200).json({ ok: true, settings: null });
        }

        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            return res.status(502).json({ ok: false, error: err.message || ('GitHub ' + r.status) });
        }

        const data = await r.json();
        const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        return res.status(200).json({ ok: true, settings: content, sha: data.sha });

    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
