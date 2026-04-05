export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const owner = process.env.GITHUB_OWNER;
    const repo  = process.env.GITHUB_REPO;
    const path  = process.env.GITHUB_SETTINGS_PATH || 'settings.json';
    const token = process.env.GITHUB_TOKEN;

    try {
        const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
        );

        if (r.status === 404) {
            // Файл ещё не создан — возвращаем пустой объект
            return res.status(200).json({ ok: true, settings: null });
        }

        if (!r.ok) {
            const err = await r.json();
            return res.status(500).json({ ok: false, error: err.message });
        }

        const data = await r.json();
        const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        return res.status(200).json({ ok: true, settings: content, sha: data.sha });

    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
