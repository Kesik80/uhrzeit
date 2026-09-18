// api/commit.js — запись озвучки в репозиторий ОДНИМ коммитом (Git Data API, основа — Yeva).
// Работает в два шага, потому что Vercel принимает не больше ~4,5 МБ за запрос:
//
//   POST { token, action: 'blobs',  files: [{ path, content }] }   → { blobs: [{ path, sha }], failed }
//        (браузер шлёт файлы пачками, content — base64)
//   POST { token, action: 'commit', tree: [{ path, sha }], deletes?: [path], message? }
//        → { ok, commit, count }
//
// Писать можно только в voice/de/<голос>/ (mp3 и voice.json) — у каждого голоса своя папка.
// Env: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, EDITOR_PASSWORD
import { checkToken, delay } from './_token.js';

export const config = { maxDuration: 60 };

const MAX_BATCH_BYTES = 3.5 * 1024 * 1024;

function safePath(p) {
  if (typeof p !== 'string') return null;
  const clean = p.replace(/^\/+/, '');
  if (clean.includes('..') || clean.length > 120) return null;
  if (!/^voice\/de\/[a-z0-9-]{1,24}\/(\d{2}-\d{2}\.mp3|voice\.json)$/.test(clean)) return null;
  return clean;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { token, action, files, tree, deletes, message } = req.body || {};
  if (!checkToken(token)) {
    await delay(500);
    return res.status(401).json({ error: 'Сессия истекла — войдите снова', code: 'auth' });
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const GH = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !GH) {
    return res.status(500).json({ error: 'Не заданы GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN' });
  }
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const H = {
    Authorization: `Bearer ${GH}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'uhrzeit-app',
  };
  async function gh(url, init) {
    const r = await fetch(url, { headers: H, ...init });
    if (!r.ok) {
      const e = new Error(`GitHub ${r.status} на ${url.replace(base, '')}`);
      e.details = (await r.text()).slice(0, 300);
      throw e;
    }
    return r.json();
  }

  // ── шаг 1: блобы ─────────────────────────────────────────
  if (action === 'blobs') {
    if (!Array.isArray(files) || !files.length || files.length > 60) {
      return res.status(400).json({ error: 'files: от 1 до 60' });
    }
    let bytes = 0;
    const clean = [];
    for (const f of files) {
      const p = safePath(f && f.path);
      if (!p) return res.status(400).json({ error: 'bad path: ' + (f && f.path) });
      if (typeof f.content !== 'string' || !f.content.length) {
        return res.status(400).json({ error: 'bad content: ' + p });
      }
      bytes += f.content.length;
      clean.push({ path: p, content: f.content });
    }
    if (bytes > MAX_BATCH_BYTES) return res.status(413).json({ error: 'пачка слишком большая' });

    const blobs = [];
    const failed = [];
    const queue = clean.slice();
    async function worker() {
      while (queue.length) {
        const f = queue.shift();
        try {
          const b = await gh(`${base}/git/blobs`, {
            method: 'POST',
            body: JSON.stringify({ content: f.content, encoding: 'base64' }),
          });
          blobs.push({ path: f.path, sha: b.sha });
        } catch (e) {
          failed.push({ path: f.path, error: e.message });
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    return res.json({ ok: true, blobs, failed });
  }

  // ── шаг 2: одно дерево, один коммит ─────────────────────
  if (action === 'commit') {
    const items = [];
    for (const t of (Array.isArray(tree) ? tree : [])) {
      const p = safePath(t && t.path);
      if (!p || !/^[0-9a-f]{40}$/.test(String(t.sha))) {
        return res.status(400).json({ error: 'bad tree item: ' + (t && t.path) });
      }
      items.push({ path: p, mode: '100644', type: 'blob', sha: t.sha });
    }
    for (const d of (Array.isArray(deletes) ? deletes : [])) {
      const p = safePath(d);
      if (!p) return res.status(400).json({ error: 'bad delete: ' + d });
      items.push({ path: p, mode: '100644', type: 'blob', sha: null });
    }
    if (!items.length || items.length > 400) return res.status(400).json({ error: 'пустой или слишком большой коммит' });

    try {
      const branch = 'main';
      const ref = await gh(`${base}/git/ref/heads/${branch}`);
      const headSha = ref.object.sha;
      const headCommit = await gh(`${base}/git/commits/${headSha}`);
      const newTree = await gh(`${base}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: items }),
      });
      const commit = await gh(`${base}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({
          message: String(message || 'Озвучка времени').slice(0, 200),
          tree: newTree.sha,
          parents: [headSha],
        }),
      });
      await gh(`${base}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha }),
      });
      return res.json({ ok: true, commit: commit.sha, count: items.length });
    } catch (e) {
      // 422 на PATCH = ветка ушла вперёд (параллельное сохранение настроек) — можно просто повторить
      return res.status(502).json({ error: e.message, details: e.details });
    }
  }

  return res.status(400).json({ error: 'action: blobs | commit' });
}
