export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { password, settings, sha } = req.body;

    // Проверяем пароль
    if (!password || password !== process.env.EDITOR_PASSWORD) {
        return res.status(401).json({ ok: false, error: 'Неверный пароль' });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo  = process.env.GITHUB_REPO;
    const path  = process.env.GITHUB_SETTINGS_PATH || 'settings.json';
    const token = process.env.GITHUB_TOKEN;

    const content = Buffer.from(JSON.stringify(settings, null, 2)).toString('base64');

    const body = {
        message: 'Update clock settings via editor',
        content,
        ...(sha ? { sha } : {}),  // sha нужен если файл уже существует
    };

    try {
        const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (!r.ok) {
            const err = await r.json();
            return res.status(500).json({ ok: false, error: err.message });
        }

        const data = await r.json();
        return res.status(200).json({ ok: true, sha: data.content.sha });

    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
