/* =====================================================================
   Shared server-side auth helpers.

   Files in /api starting with "_" are not exposed as routes — this is a
   private module used by login.js and publish.js.

   Sessions are stateless: we hand the browser a token that is
   HMAC-signed with a server-only secret, so it cannot be forged.
   ===================================================================== */

const crypto = require('crypto');

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

/* ---------- config ---------- */
function adminEmail() {
  return (process.env.ADMIN_EMAIL || 'jl@fluxmedia.org').trim().toLowerCase();
}

// The login password. PUBLISH_KEY is accepted as a fallback so an existing
// setup keeps working without adding a second secret.
function adminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.PUBLISH_KEY || '';
}

// Signing key. Derived from the other secrets when SESSION_SECRET is unset so
// there is one less thing to configure.
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const pw = adminPassword();
  const gh = process.env.GITHUB_TOKEN || '';
  if (!pw && !gh) return null;
  return crypto.createHash('sha256').update('alpreps-bracketology|' + pw + '|' + gh).digest('hex');
}

/* ---------- primitives ---------- */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/* ---------- tokens ---------- */
function issueSession() {
  const key = sessionSecret();
  if (!key) return null;
  const payload = { sub: 'admin', exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = b64url(JSON.stringify(payload));
  const mac = b64url(crypto.createHmac('sha256', key).update(body).digest());
  return { token: body + '.' + mac, expiresAt: payload.exp * 1000 };
}

// -> { valid: true } | { valid: false, reason: 'expired' | 'invalid' | 'unconfigured' }
function verifySession(token) {
  const key = sessionSecret();
  if (!key) return { valid: false, reason: 'unconfigured' };
  if (typeof token !== 'string' || token.indexOf('.') < 0) return { valid: false, reason: 'invalid' };

  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'invalid' };
  const body = parts[0];
  const expected = b64url(crypto.createHmac('sha256', key).update(body).digest());
  if (!safeEqual(parts[1], expected)) return { valid: false, reason: 'invalid' };

  let payload;
  try {
    payload = JSON.parse(unb64url(body).toString('utf8'));
  } catch (e) {
    return { valid: false, reason: 'invalid' };
  }
  if (!payload || payload.sub !== 'admin') return { valid: false, reason: 'invalid' };
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true };
}

/* ---------- http helpers ---------- */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

// Small constant delay on auth failure to blunt online guessing.
function slowDown() {
  return new Promise(function (r) { setTimeout(r, 400); });
}

module.exports = {
  SESSION_TTL_SECONDS: SESSION_TTL_SECONDS,
  adminEmail: adminEmail,
  adminPassword: adminPassword,
  sessionSecret: sessionSecret,
  safeEqual: safeEqual,
  issueSession: issueSession,
  verifySession: verifySession,
  send: send,
  readBody: readBody,
  slowDown: slowDown,
};
