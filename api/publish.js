/* =====================================================================
   POST /api/publish  —  writes data/data.json to GitHub, which triggers a
   Vercel redeploy so the edit is live for everyone.

   Required Vercel environment variables:
     PUBLISH_KEY   a secret you choose; the admin must supply it to publish
     GITHUB_TOKEN  a GitHub token with contents:write on the repo
   Optional:
     GITHUB_REPO   "owner/repo"  (default: jlflux/jlflux.github.io)
     GITHUB_BRANCH branch to commit to (default: main)

   The token never reaches the browser — it is only used here, server-side.
   ===================================================================== */

const DEFAULT_REPO = 'jlflux/jlflux.github.io';
const DEFAULT_BRANCH = 'main';
const FILE_PATH = 'data/data.json';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Constant-time-ish compare so we don't leak the key via response timing.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function gh(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'alpreps-bracketology-publish',
    'Content-Type': 'application/json',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });

  const key = process.env.PUBLISH_KEY;
  const token = process.env.GITHUB_TOKEN;
  if (!key || !token) {
    return send(res, 500, {
      error: 'Server is not configured. Set PUBLISH_KEY and GITHUB_TOKEN in the Vercel project environment variables.',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, { error: 'Request body was not valid JSON.' });
  }

  if (!safeEqual(String(body.key || ''), key)) {
    return send(res, 401, { error: 'Wrong publish key.' });
  }

  const data = body.data;
  if (!data || typeof data !== 'object' || !data.classifications) {
    return send(res, 400, { error: 'Payload did not look like bracket data.' });
  }

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
  const apiUrl = 'https://api.github.com/repos/' + repo + '/contents/' + FILE_PATH;

  try {
    // Current file SHA (needed to update rather than create).
    let sha;
    const cur = await fetch(apiUrl + '?ref=' + encodeURIComponent(branch), { headers: gh(token) });
    if (cur.status === 200) {
      sha = (await cur.json()).sha;
    } else if (cur.status !== 404) {
      const detail = await cur.text();
      return send(res, 502, { error: 'Could not read the current data.json from GitHub.', detail: detail.slice(0, 400) });
    }

    const pretty = JSON.stringify(data, null, 2) + '\n';
    const payload = {
      message: 'Publish bracket data update',
      content: Buffer.from(pretty, 'utf8').toString('base64'),
      branch: branch,
    };
    if (sha) payload.sha = sha;

    const put = await fetch(apiUrl, {
      method: 'PUT',
      headers: gh(token),
      body: JSON.stringify(payload),
    });

    if (!put.ok) {
      const detail = await put.text();
      const hint = put.status === 409
        ? 'The file changed since this browser last loaded it. Reload the admin and publish again.'
        : undefined;
      return send(res, 502, { error: 'GitHub rejected the commit.', hint: hint, detail: detail.slice(0, 400) });
    }

    const out = await put.json();
    return send(res, 200, {
      ok: true,
      commit: out.commit && out.commit.sha ? out.commit.sha.slice(0, 7) : null,
    });
  } catch (e) {
    return send(res, 500, { error: 'Publish failed: ' + (e && e.message ? e.message : 'unknown error') });
  }
};
