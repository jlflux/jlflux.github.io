/* =====================================================================
   POST /api/login  —  verifies the admin email + password against
   server-side environment variables and returns a signed session token.

   Environment variables:
     ADMIN_PASSWORD  required (PUBLISH_KEY is accepted as a fallback)
     ADMIN_EMAIL     optional, defaults to jl@fluxmedia.org
     SESSION_SECRET  optional, derived from the other secrets when unset

   The password is never shipped to the browser — only checked here.
   ===================================================================== */

const auth = require('./_auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return auth.send(res, 405, { error: 'Use POST.' });

  const password = auth.adminPassword();
  if (!password) {
    return auth.send(res, 500, {
      error: 'Login is not configured. Set ADMIN_PASSWORD in the Vercel project environment variables.',
      unconfigured: true,
    });
  }

  let body;
  try {
    body = await auth.readBody(req);
  } catch (e) {
    return auth.send(res, 400, { error: 'Request body was not valid JSON.' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const pass = String(body.password || '');

  const emailOk = auth.safeEqual(email, auth.adminEmail());
  const passOk = auth.safeEqual(pass, password);

  if (!emailOk || !passOk) {
    await auth.slowDown();
    return auth.send(res, 401, { error: 'Incorrect email or password.' });
  }

  const session = auth.issueSession();
  if (!session) {
    return auth.send(res, 500, { error: 'Could not sign a session. Set SESSION_SECRET in the Vercel project environment variables.' });
  }

  return auth.send(res, 200, { ok: true, token: session.token, expiresAt: session.expiresAt });
};
