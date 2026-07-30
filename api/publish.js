/* =====================================================================
   POST /api/publish  —  writes data/data.json to GitHub, which triggers a
   Vercel redeploy so the edit is live for everyone.

   Requires a valid admin session token from POST /api/login (a raw
   PUBLISH_KEY is also accepted for backwards compatibility).

   Environment variables:
     GITHUB_TOKEN   required — token with contents:write on the repo
     ADMIN_PASSWORD required for login (PUBLISH_KEY works as a fallback)
   Optional:
     GITHUB_REPO    "owner/repo"  (default: jlflux/jlflux.github.io)
     GITHUB_BRANCH  branch to commit to (default: main)

   The GitHub token never reaches the browser — it is only used here.
   ===================================================================== */

const auth = require('./_auth.js');

const DEFAULT_REPO = 'jlflux/jlflux.github.io';
const DEFAULT_BRANCH = 'main';
const FILE_PATH = 'data/data.json';

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
  if (req.method !== 'POST') return auth.send(res, 405, { error: 'Use POST.' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return auth.send(res, 500, {
      error: 'Publishing is not configured. Set GITHUB_TOKEN in the Vercel project environment variables.',
    });
  }

  let body;
  try {
    body = await auth.readBody(req);
  } catch (e) {
    return auth.send(res, 400, { error: 'Request body was not valid JSON.' });
  }

  // --- authorise: signed session token, or a raw PUBLISH_KEY (legacy) ---
  let authorised = false;
  let reason = 'invalid';
  if (body.token) {
    const v = auth.verifySession(body.token);
    authorised = v.valid;
    reason = v.reason || 'invalid';
  }
  if (!authorised && body.key && process.env.PUBLISH_KEY) {
    authorised = auth.safeEqual(String(body.key), process.env.PUBLISH_KEY);
  }
  if (!authorised) {
    await auth.slowDown();
    return auth.send(res, 401, {
      error: reason === 'expired'
        ? 'Your session expired. Please log in again.'
        : 'Not authorised. Please log in again.',
      reason: reason,
    });
  }

  const data = body.data;
  if (!data || typeof data !== 'object' || !data.classifications) {
    return auth.send(res, 400, { error: 'Payload did not look like bracket data.' });
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
      return auth.send(res, 502, { error: 'Could not read the current data.json from GitHub.', detail: detail.slice(0, 400) });
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
      return auth.send(res, 502, { error: 'GitHub rejected the commit.', hint: hint, detail: detail.slice(0, 400) });
    }

    const out = await put.json();
    return auth.send(res, 200, {
      ok: true,
      commit: out.commit && out.commit.sha ? out.commit.sha.slice(0, 7) : null,
    });
  } catch (e) {
    return auth.send(res, 500, { error: 'Publish failed: ' + (e && e.message ? e.message : 'unknown error') });
  }
};
