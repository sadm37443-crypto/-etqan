import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, pingDatabase, query } from './db.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const sessionCookie = 'webdev_app_session';
const stateCookie = 'itqan_oauth_state';
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t'
};

function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [index >= 0 ? part.slice(0, index) : part, index >= 0 ? decodeURIComponent(part.slice(index + 1)) : ''];
  }));
}
function cookie(name, value, options = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) attributes.push('HttpOnly');
  if (options.sameSite) attributes.push(`SameSite=${options.sameSite}`);
  if (options.secure) attributes.push('Secure');
  return attributes.join('; ');
}
function base64url(input) { return Buffer.from(input).toString('base64url'); }
function decodeBase64Json(value) { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }
function signJwt(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', process.env.MANUS_JWT_SECRET || 'preview-only-missing-secret').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}
function verifyJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', process.env.MANUS_JWT_SECRET || 'preview-only-missing-secret').update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = decodeBase64Json(parts[1]);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (process.env.MANUS_PROJECT_ID && payload.appId && payload.appId !== process.env.MANUS_PROJECT_ID) return null;
    return payload;
  } catch { return null; }
}
function safeOrigin(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}
function browserOrigin(req) {
  return safeOrigin(req.headers.origin) || safeOrigin(req.headers.referer || '') || `http://${req.headers.host || 'localhost'}`;
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw Object.assign(new Error('Request too large'), { code: 'PAYLOAD_TOO_LARGE' });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON'), { code: 'INVALID_JSON' }); }
}
async function rawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw Object.assign(new Error('Request too large'), { code: 'PAYLOAD_TOO_LARGE' });
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
function cleanText(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function userFromPayload(payload) { return payload?.openId || payload?.open_id || payload?.sub || payload?.user?.openId || null; }

function stripeConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY); }
async function stripeRequest(path, params) {
  const cleanParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.STRIPE_SECRET_KEY}:`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(cleanParams)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || 'Stripe request failed'), { code: 'STRIPE_REQUEST_FAILED', stripe: result });
  return result;
}
function verifyStripeSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(signature.split(',').map((part) => part.split('=')));
  const timestamp = Number(parts.t);
  const signed = `${parts.t}.${payload}`;
  const expected = createHmac('sha256', secret).update(signed).digest('hex');
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(parts.v1, 'utf8');
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}
function periodEndDate() { return new Date(Date.now() + 31 * 24 * 60 * 60 * 1000); }

async function upsertUser(identity) {
  const openId = cleanText(identity.openId, 191);
  if (!openId) return null;
  const name = cleanText(identity.name || identity.email || 'طالب إتقان', 160) || 'طالب إتقان';
  const email = cleanText(identity.email, 255) || null;
  const avatar = cleanText(identity.avatarUrl || identity.avatar_url, 500) || null;
  await query(`INSERT INTO users (open_id, name, email, avatar_url) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), avatar_url=VALUES(avatar_url)`, [openId, name, email, avatar]);
  const rows = await query('SELECT id, open_id AS openId, name, email, avatar_url AS avatarUrl, role, created_at AS createdAt FROM users WHERE open_id = ?', [openId]);
  return rows[0] || null;
}
async function currentUser(req) {
  const payload = verifyJwt(parseCookies(req)[sessionCookie]);
  const openId = userFromPayload(payload);
  if (!openId) return null;
  const rows = await query('SELECT id, open_id AS openId, name, email, avatar_url AS avatarUrl, role, created_at AS createdAt FROM users WHERE open_id = ?', [openId]);
  return rows[0] || null;
}
async function requireUser(req, res) {
  const user = await currentUser(req);
  if (!user) { json(res, 401, { error: 'AUTH_REQUIRED', message: 'يرجى تسجيل الدخول أولًا.' }); return null; }
  return user;
}
async function requireRole(req, res, roles = ['admin']) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!roles.includes(user.role)) { json(res, 403, { error: 'FORBIDDEN', message: 'ليس لديك صلاحية لهذه العملية.' }); return null; }
  return user;
}
function questionView(row) {
  let options = row.optionsJson;
  if (typeof options === 'string') { try { options = JSON.parse(options); } catch { options = []; } }
  return { id: row.id, examType: row.examType, skill: row.skill, prompt: row.prompt, options: options || [], difficulty: row.difficulty, questionType: row.questionType || 'mcq' };
}
async function chooseQuestion(examType, difficulty, sessionId) {
  const rows = await query(`SELECT q.id, q.exam_type AS examType, q.skill, q.prompt, q.options_json AS optionsJson, q.correct_index AS correctIndex, q.explanation, q.difficulty, q.question_type AS questionType
    FROM quiz_questions q WHERE q.exam_type=? AND q.status='published' AND q.question_type='mcq' AND q.difficulty=?
    AND q.id NOT IN (SELECT question_id FROM quiz_session_questions WHERE session_id=?) ORDER BY RAND() LIMIT 1`, [examType, difficulty, sessionId]);
  if (rows[0]) return rows[0];
  const fallback = await query(`SELECT q.id, q.exam_type AS examType, q.skill, q.prompt, q.options_json AS optionsJson, q.correct_index AS correctIndex, q.explanation, q.difficulty, q.question_type AS questionType
    FROM quiz_questions q WHERE q.exam_type=? AND q.status='published' AND q.question_type='mcq' AND q.id NOT IN (SELECT question_id FROM quiz_session_questions WHERE session_id=?) ORDER BY RAND() LIMIT 1`, [examType, sessionId]);
  return fallback[0] || null;
}
async function activatePlan({ userId, planCode, provider, externalId, providerSubscriptionId = null, providerCustomerId = null, status = 'active' }) {
  const plans = await query('SELECT id, code, amount, currency, interval_name AS intervalName FROM plans WHERE code=? AND status=\'active\'', [planCode]);
  const plan = plans[0];
  if (!plan) throw Object.assign(new Error('Plan not found'), { code: 'PLAN_NOT_FOUND' });
  const existing = providerSubscriptionId ? await query('SELECT id FROM subscriptions WHERE provider_subscription_id=? LIMIT 1', [providerSubscriptionId]) : [];
  let subscriptionId = existing[0]?.id;
  if (subscriptionId) {
    await query('UPDATE subscriptions SET user_id=?, plan_id=?, provider=?, provider_customer_id=?, status=?, current_period_end=? WHERE id=?', [userId, plan.id, provider, providerCustomerId, status, periodEndDate(), subscriptionId]);
  } else {
    const result = await query('INSERT INTO subscriptions (user_id, plan_id, provider, provider_customer_id, provider_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, plan.id, provider, providerCustomerId, providerSubscriptionId, status, periodEndDate()]);
    subscriptionId = result.insertId;
  }
  await query(`INSERT INTO entitlements (user_id, entitlement_key, source_type, source_id, status, starts_at, ends_at)
    VALUES (?, ?, 'subscription', ?, 'active', NOW(), ?)
    ON DUPLICATE KEY UPDATE status='active', ends_at=VALUES(ends_at)`, [userId, 'plan:' + plan.code, subscriptionId, periodEndDate()]);
  if (externalId) {
    await query(`INSERT INTO payment_transactions (user_id, subscription_id, provider, external_id, kind, amount, currency, status, metadata_json)
      VALUES (?, ?, ?, ?, 'subscription', ?, ?, 'succeeded', ?)
      ON DUPLICATE KEY UPDATE subscription_id=VALUES(subscription_id), status='succeeded', metadata_json=VALUES(metadata_json)`, [userId, subscriptionId, provider, externalId, plan.amount, plan.currency, JSON.stringify({ planCode: plan.code })]);
  }
  return { subscriptionId, plan };
}
async function fulfillStripeCheckout(session) {
  const userId = Number(session?.metadata?.user_id || session?.client_reference_id);
  const planCode = cleanText(session?.metadata?.plan_code, 80);
  if (!userId || !planCode) return { fulfilled: false, reason: 'MISSING_CHECKOUT_METADATA' };
  const result = await activatePlan({ userId, planCode, provider: 'stripe', externalId: session.payment_intent || session.id, providerSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null, providerCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null });
  return { fulfilled: true, ...result };
}
async function processStripeEvent(event) {
  const inserted = await query('INSERT IGNORE INTO webhook_events (provider, event_id, event_type) VALUES (\'stripe\', ?, ?)', [event.id, event.type]);
  if (!inserted.affectedRows) return { duplicate: true };
  if (event.type === 'checkout.session.completed') await fulfillStripeCheckout(event.data?.object || {});
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data?.object || {};
    await query('UPDATE subscriptions SET status=?, cancel_at_period_end=? WHERE provider_subscription_id=?', [subscription.status || (event.type.endsWith('deleted') ? 'canceled' : 'unknown'), subscription.cancel_at_period_end ? 1 : 0, subscription.id]);
  }
  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data?.object || {};
    await query('UPDATE payment_transactions SET status=\'failed\' WHERE provider=\'stripe\' AND external_id=?', [intent.id]);
  }
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data?.object || {};
    await query('UPDATE payment_transactions SET status=\'succeeded\' WHERE provider=\'stripe\' AND external_id=?', [intent.id]);
  }
  return { duplicate: false };
}
async function oauthLogin(req, res, url) {
  const portal = process.env.MANUS_OAUTH_PORTAL_URL;
  const projectId = process.env.MANUS_PROJECT_ID;
  if (!portal || !projectId) return json(res, 503, { error: 'OAUTH_NOT_CONFIGURED', message: 'تسجيل الدخول غير مهيأ بعد.' });
  const origin = safeOrigin(url.searchParams.get('origin')) || browserOrigin(req);
  const redirectUri = `${origin}/api/auth/callback`;
  const nonce = randomBytes(24).toString('hex');
  const state = base64url(JSON.stringify({ redirectUri, nonce }));
  const login = new URL('/app-auth', portal);
  login.searchParams.set('appId', projectId);
  login.searchParams.set('redirectUri', redirectUri);
  login.searchParams.set('state', state);
  login.searchParams.set('responseType', 'code');
  res.writeHead(302, { Location: login.toString(), 'Set-Cookie': cookie(stateCookie, nonce, { maxAge: 600, sameSite: 'None', secure: true }) });
  res.end();
}
async function oauthCallback(req, res, url) {
  const params = url.searchParams;
  const state = params.get('state');
  const code = params.get('code');
  let decoded;
  try { decoded = decodeBase64Json(state || ''); } catch { return json(res, 400, { error: 'INVALID_OAUTH_STATE' }); }
  const cookies = parseCookies(req);
  if (!code || !decoded?.nonce || decoded.nonce !== cookies[stateCookie]) return json(res, 400, { error: 'OAUTH_STATE_MISMATCH' });
  const api = process.env.MANUS_OAUTH_API_URL;
  try {
    const exchanged = await fetch(`${api}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: process.env.MANUS_PROJECT_ID, grantType: 'authorization_code', code, redirectUri: decoded.redirectUri }) });
    if (!exchanged.ok) return json(res, 502, { error: 'OAUTH_EXCHANGE_FAILED' });
    const token = await exchanged.json();
    const identityResponse = await fetch(`${api}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: token.accessToken }) });
    if (!identityResponse.ok) return json(res, 502, { error: 'OAUTH_IDENTITY_FAILED' });
    const identity = await identityResponse.json();
    const user = await upsertUser(identity);
    const session = signJwt({ appId: process.env.MANUS_PROJECT_ID, openId: user.openId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 });
    res.writeHead(302, { Location: '/', 'Set-Cookie': [cookie(sessionCookie, session, { maxAge: 60 * 60 * 24 * 30, sameSite: 'None', secure: true }), cookie(stateCookie, '', { maxAge: 0, sameSite: 'None', secure: true })] });
    res.end();
  } catch (error) { json(res, 502, { error: 'OAUTH_UNAVAILABLE', detail: error.message }); }
}

async function handleApi(req, res, url) {
  const path = url.pathname;
  if (req.method === 'GET' && path === '/api/health') {
    const database = await pingDatabase();
    return json(res, 200, { ok: true, service: 'itqan-global', database, timestamp: new Date().toISOString() });
  }
  if (req.method === 'POST' && path === '/api/stripe/webhook') {
    const raw = await rawBody(req);
    if (!process.env.STRIPE_WEBHOOK_SECRET || !verifyStripeSignature(raw.toString('utf8'), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) return json(res, 400, { error: 'INVALID_STRIPE_SIGNATURE' });
    let event;
    try { event = JSON.parse(raw.toString('utf8')); } catch { return json(res, 400, { error: 'INVALID_STRIPE_EVENT' }); }
    try { const result = await processStripeEvent(event); return json(res, 200, { received: true, duplicate: result.duplicate }); }
    catch (error) { console.error('stripe webhook error', error); return json(res, 500, { error: 'WEBHOOK_PROCESSING_FAILED' }); }
  }
  if (req.method === 'GET' && path === '/api/auth/login') return oauthLogin(req, res, url);
  if (req.method === 'GET' && path === '/api/auth/callback') return oauthCallback(req, res, url);
  if (req.method === 'POST' && path === '/api/auth/logout') {
    res.writeHead(204, { 'Set-Cookie': cookie(sessionCookie, '', { maxAge: 0, sameSite: 'None', secure: true }) }); res.end(); return;
  }
  if (req.method === 'GET' && path === '/api/auth/me') {
    const user = await currentUser(req); return json(res, 200, { authenticated: Boolean(user), user });
  }
  if (req.method === 'GET' && path === '/api/plans') {
    const plans = await query(`SELECT code, title, description, amount, currency, interval_name AS intervalName, features_json AS featuresJson
      FROM plans WHERE status='active' ORDER BY amount`);
    return json(res, 200, { plans: plans.map((plan) => ({ ...plan, features: typeof plan.featuresJson === 'string' ? JSON.parse(plan.featuresJson) : plan.featuresJson })) });
  }
  if (req.method === 'GET' && path === '/api/billing/status') {
    const user = await requireUser(req, res); if (!user) return;
    const [subscriptions, history] = await Promise.all([
      query(`SELECT s.id, p.code AS planCode, p.title, s.provider, s.status, s.current_period_end AS currentPeriodEnd, s.cancel_at_period_end AS cancelAtPeriodEnd
        FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT 5`, [user.id]),
      query(`SELECT id, provider, external_id AS externalId, amount, currency, status, created_at AS createdAt FROM payment_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 20`, [user.id])
    ]);
    return json(res, 200, { subscriptions, history });
  }
  if (req.method === 'POST' && path === '/api/billing/checkout') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const planCode = cleanText(input.planCode || 'student-egypt-monthly', 80);
    const plans = await query('SELECT code, title, description, amount, currency, interval_name AS intervalName FROM plans WHERE code=? AND status=\'active\'', [planCode]);
    const plan = plans[0]; if (!plan) return json(res, 404, { error: 'PLAN_NOT_FOUND' });
    if (!stripeConfigured()) {
      const externalId = `mock_${randomBytes(12).toString('hex')}`;
      await query(`INSERT INTO payment_transactions (user_id, provider, external_id, kind, amount, currency, status, metadata_json)
        VALUES (?, 'mock', ?, 'subscription', ?, ?, 'pending', ?)`, [user.id, externalId, plan.amount, plan.currency, JSON.stringify({ planCode })]);
      return json(res, 200, { provider: 'mock', testMode: true, sessionId: externalId, message: 'وضع الاختبار المحلي: لم يتم تحصيل أي مبلغ.', confirmEndpoint: '/api/billing/mock/confirm' });
    }
    try {
      const origin = browserOrigin(req);
      const session = await stripeRequest('checkout/sessions', {
        mode: 'subscription', allow_promotion_codes: 'true', customer_email: user.email || undefined,
        client_reference_id: String(user.id), 'metadata[user_id]': String(user.id), 'metadata[plan_code]': plan.code,
        'line_items[0][price_data][currency]': plan.currency.toLowerCase(), 'line_items[0][price_data][unit_amount]': String(Math.round(Number(plan.amount) * 100)),
        'line_items[0][price_data][recurring][interval]': plan.intervalName, 'line_items[0][price_data][product_data][name]': plan.title,
        'line_items[0][quantity]': '1', success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/?checkout=cancelled`
      });
      await query(`INSERT INTO payment_transactions (user_id, provider, external_id, kind, amount, currency, status, metadata_json)
        VALUES (?, 'stripe', ?, 'subscription', ?, ?, 'pending', ?)`, [user.id, session.id, plan.amount, plan.currency, JSON.stringify({ planCode })]);
      return json(res, 200, { provider: 'stripe', testMode: true, checkoutUrl: session.url, sessionId: session.id });
    } catch (error) { return json(res, 502, { error: error.code || 'CHECKOUT_FAILED', message: error.message }); }
  }
  if (req.method === 'POST' && path === '/api/billing/mock/confirm') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const sessionId = cleanText(input.sessionId, 255);
    const rows = await query('SELECT id, external_id AS externalId, status, metadata_json AS metadataJson FROM payment_transactions WHERE user_id=? AND provider=\'mock\' AND external_id=? LIMIT 1', [user.id, sessionId]);
    const transaction = rows[0]; if (!transaction) return json(res, 404, { error: 'MOCK_SESSION_NOT_FOUND' });
    if (transaction.status === 'succeeded') return json(res, 200, { ok: true, alreadyCompleted: true });
    const metadata = typeof transaction.metadataJson === 'string' ? JSON.parse(transaction.metadataJson) : transaction.metadataJson;
    const activated = await activatePlan({ userId: user.id, planCode: metadata.planCode, provider: 'mock', externalId: sessionId, providerSubscriptionId: `mock_sub_${randomBytes(8).toString('hex')}` });
    return json(res, 200, { ok: true, testMode: true, subscriptionId: activated.subscriptionId, message: 'اكتمل الاشتراك التجريبي وتم تفعيل الصلاحية لمدة شهر.' });
  }
  if (req.method === 'GET' && path === '/api/billing/history') {
    const user = await requireUser(req, res); if (!user) return;
    const rows = await query(`SELECT t.id, t.provider, t.external_id AS externalId, t.amount, t.currency, t.status, t.created_at AS createdAt, p.title AS planTitle
      FROM payment_transactions t LEFT JOIN subscriptions s ON s.id=t.subscription_id LEFT JOIN plans p ON p.id=s.plan_id WHERE t.user_id=? ORDER BY t.created_at DESC`, [user.id]);
    return json(res, 200, { history: rows });
  }
  if (req.method === 'POST' && path === '/api/billing/refund') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const subscriptionId = Number(input.subscriptionId); const reason = cleanText(input.reason || 'طلب استرداد خلال الفترة التجريبية', 500);
    const rows = await query(`SELECT id, provider, status, created_at AS createdAt FROM subscriptions WHERE id=? AND user_id=? LIMIT 1`, [subscriptionId, user.id]);
    const subscription = rows[0]; if (!subscription) return json(res, 404, { error: 'SUBSCRIPTION_NOT_FOUND' });
    const ageDays = (Date.now() - new Date(subscription.createdAt).getTime()) / 86400000;
    if (ageDays > 14) return json(res, 409, { error: 'REFUND_WINDOW_EXPIRED', message: 'انتهت نافذة الاسترداد البالغة 14 يومًا.' });
    await query('INSERT INTO refund_requests (user_id, subscription_id, reason, status) VALUES (?, ?, ?, ?)', [user.id, subscriptionId, reason, subscription.provider === 'mock' ? 'approved_test' : 'requested']);
    if (subscription.provider === 'mock') {
      await query('UPDATE subscriptions SET status=\'refunded\' WHERE id=?', [subscriptionId]);
      await query('UPDATE entitlements SET status=\'revoked\' WHERE user_id=? AND source_type=\'subscription\' AND source_id=?', [user.id, subscriptionId]);
      await query('UPDATE payment_transactions SET status=\'refunded\' WHERE subscription_id=?', [subscriptionId]);
      return json(res, 200, { ok: true, status: 'refunded', testMode: true });
    }
    return json(res, 202, { ok: true, status: 'requested', message: 'تم تسجيل طلب الاسترداد للمراجعة.' });
  }
  if (req.method === 'GET' && path === '/api/courses') {
    const user = await currentUser(req);
    const filters = [];
    const values = [];
    for (const [key, column] of [['stage', 'stage'], ['system', 'system_name'], ['subject', 'subject'], ['type', 'content_type']]) {
      if (url.searchParams.get(key)) { filters.push(`${column} = ?`); values.push(url.searchParams.get(key)); }
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query(`SELECT c.id, c.slug, c.title, c.track, c.system_name AS systemName, c.stage, c.subject, c.content_type AS contentType, c.description, c.lessons_count AS lessonsCount, c.level, COALESCE(e.progress_percent, 0) AS progress FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id ${user ? 'AND e.user_id = ?' : ''} ${where} ORDER BY c.id`, user ? [user.id, ...values] : values);
    return json(res, 200, { courses: rows });
  }
  if (req.method === 'GET' && path.startsWith('/api/courses/')) {
    const slug = decodeURIComponent(path.slice('/api/courses/'.length));
    const rows = await query('SELECT id, slug, title, track, system_name AS systemName, stage, subject, content_type AS contentType, description, lessons_count AS lessonsCount, level FROM courses WHERE slug = ?', [slug]);
    if (!rows[0]) return json(res, 404, { error: 'COURSE_NOT_FOUND' });
    const lessons = await query('SELECT id, title, duration_minutes AS durationMinutes, position, content FROM lessons WHERE course_id = ? ORDER BY position', [rows[0].id]);
    return json(res, 200, { course: rows[0], lessons });
  }
  if (req.method === 'GET' && path.match(/^\/api\/lessons\/\d+\/assets$/)) {
    const user = await requireUser(req, res); if (!user) return;
    const lessonId = Number(path.split('/')[3]);
    const allowed = await query(`SELECT 1 FROM enrollments e JOIN lessons l ON l.course_id=e.course_id WHERE e.user_id=? AND l.id=?
      UNION SELECT 1 FROM entitlements WHERE user_id=? AND entitlement_key='plan:student-egypt-monthly' AND status='active' AND (ends_at IS NULL OR ends_at > NOW()) LIMIT 1`, [user.id, lessonId, user.id]);
    if (!allowed[0]) return json(res, 403, { error: 'ENTITLEMENT_REQUIRED', message: 'التحق بالمسار أو فعّل الباقة للوصول إلى الأصول.' });
    const assets = await query('SELECT id, kind, title, storage_path AS storagePath, duration_seconds AS durationSeconds FROM content_assets WHERE lesson_id=? ORDER BY id', [lessonId]);
    return json(res, 200, { assets, accessMode: 'mvp-preview', note: 'هذه أصول MVP تجريبية دون DRM.' });
  }
  if (req.method === 'POST' && path.match(/^\/api\/courses\/[^/]+\/enroll$/)) {
    const user = await requireUser(req, res); if (!user) return;
    const slug = decodeURIComponent(path.split('/')[3]);
    const rows = await query('SELECT id FROM courses WHERE slug = ?', [slug]);
    if (!rows[0]) return json(res, 404, { error: 'COURSE_NOT_FOUND' });
    await query('INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', [user.id, rows[0].id]);
    return json(res, 201, { ok: true, message: 'تمت إضافة المسار إلى رحلتك.' });
  }
  if (req.method === 'GET' && path === '/api/dashboard') {
    const user = await requireUser(req, res); if (!user) return;
    const [enrollments, attempts, recentLessons] = await Promise.all([
      query(`SELECT c.title, c.track, e.progress_percent AS progress, e.updated_at AS updatedAt FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? ORDER BY e.updated_at DESC LIMIT 6`, [user.id]),
      query('SELECT exam_type AS examType, score, total_questions AS totalQuestions, created_at AS createdAt FROM quiz_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 5', [user.id]),
      query(`SELECT l.title, c.title AS courseTitle, lp.completed, lp.updated_at AS updatedAt FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id JOIN courses c ON c.id=l.course_id WHERE lp.user_id=? ORDER BY lp.updated_at DESC LIMIT 5`, [user.id])
    ]);
    return json(res, 200, { user, enrollments, attempts, recentLessons });
  }
  if (req.method === 'POST' && path === '/api/progress') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req);
    const lessonId = Number(input.lessonId); const completed = Boolean(input.completed); const watchedSeconds = Math.max(0, Number(input.watchedSeconds || 0));
    if (!Number.isInteger(lessonId) || lessonId <= 0) return json(res, 400, { error: 'INVALID_LESSON' });
    const enrolled = await query('SELECT e.id FROM enrollments e JOIN lessons l ON l.course_id=e.course_id WHERE e.user_id=? AND l.id=?', [user.id, lessonId]);
    if (!enrolled[0]) return json(res, 403, { error: 'ENROLLMENT_REQUIRED', message: 'التحق بالمسار أولًا لحفظ التقدم.' });
    await query(`INSERT INTO lesson_progress (user_id, lesson_id, completed, watched_seconds) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE completed=VALUES(completed), watched_seconds=VALUES(watched_seconds)`, [user.id, lessonId, completed ? 1 : 0, watchedSeconds]);
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/quiz/attempts') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const examType = cleanText(input.examType || 'قدرات كمي', 80); const total = Math.max(1, Number(input.totalQuestions || 1)); const score = Math.min(100, Math.max(0, Number(input.score || 0)));
    await query('INSERT INTO quiz_attempts (user_id, exam_type, score, total_questions, answers_json) VALUES (?, ?, ?, ?, ?)', [user.id, examType, score, total, JSON.stringify(input.answers || {})]);
    return json(res, 201, { ok: true, score, message: 'تم حفظ المحاولة في سجل تقدمك.' });
  }
  if (req.method === 'POST' && path === '/api/quiz/sessions') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const examType = cleanText(input.examType || 'ثانوية عامة — رياضيات', 80); const questionCount = Math.min(10, Math.max(3, Number(input.questionCount || 5)));
    await query('INSERT INTO quiz_sessions (user_id, exam_type, question_count) VALUES (?, ?, ?)', [user.id, examType, questionCount]);
    const sessionRows = await query('SELECT id, exam_type AS examType, question_count AS questionCount, current_difficulty AS currentDifficulty FROM quiz_sessions WHERE user_id=? ORDER BY id DESC LIMIT 1', [user.id]);
    const session = sessionRows[0]; const question = await chooseQuestion(examType, 1, session.id);
    if (!question) return json(res, 404, { error: 'QUESTION_BANK_EMPTY' });
    await query('INSERT INTO quiz_session_questions (session_id, question_id, position) VALUES (?, ?, 1)', [session.id, question.id]);
    return json(res, 201, { session, progress: { answered: 0, total: questionCount }, question: questionView(question) });
  }
  if (req.method === 'POST' && path.match(/^\/api\/quiz\/sessions\/\d+\/answer$/)) {
    const user = await requireUser(req, res); if (!user) return;
    const sessionId = Number(path.split('/')[4]); const input = await body(req); const selectedIndex = Number(input.selectedIndex);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0) return json(res, 400, { error: 'INVALID_ANSWER' });
    const sessions = await query('SELECT id, exam_type AS examType, question_count AS questionCount, answered_count AS answeredCount, correct_count AS correctCount, current_difficulty AS currentDifficulty, status FROM quiz_sessions WHERE id=? AND user_id=?', [sessionId, user.id]);
    const session = sessions[0]; if (!session || session.status !== 'active') return json(res, 404, { error: 'QUIZ_SESSION_NOT_FOUND' });
    const pending = await query(`SELECT sq.id AS sessionQuestionId, sq.position, q.correct_index AS correctIndex, q.explanation, q.difficulty
      FROM quiz_session_questions sq JOIN quiz_questions q ON q.id=sq.question_id WHERE sq.session_id=? AND sq.selected_index IS NULL ORDER BY sq.position DESC LIMIT 1`, [sessionId]);
    const current = pending[0]; if (!current) return json(res, 409, { error: 'QUESTION_ALREADY_ANSWERED' });
    const correct = selectedIndex === Number(current.correctIndex);
    const answeredCount = Number(session.answeredCount) + 1; const correctCount = Number(session.correctCount) + (correct ? 1 : 0);
    await query('UPDATE quiz_session_questions SET selected_index=?, is_correct=?, answered_at=CURRENT_TIMESTAMP WHERE id=?', [selectedIndex, correct ? 1 : 0, current.sessionQuestionId]);
    if (answeredCount >= Number(session.questionCount)) {
      const score = Math.round((correctCount / Number(session.questionCount)) * 100);
      await query('UPDATE quiz_sessions SET answered_count=?, correct_count=?, status=\'completed\', completed_at=CURRENT_TIMESTAMP WHERE id=?', [answeredCount, correctCount, sessionId]);
      await query('INSERT INTO quiz_attempts (user_id, exam_type, score, total_questions, answers_json) VALUES (?, ?, ?, ?, ?)', [user.id, session.examType, score, session.questionCount, JSON.stringify({ sessionId })]);
      return json(res, 200, { completed: true, correct, explanation: current.explanation, score, progress: { answered: answeredCount, total: session.questionCount } });
    }
    const nextDifficulty = Math.min(3, Math.max(1, Number(current.difficulty) + (correct ? 1 : -1)));
    await query('UPDATE quiz_sessions SET answered_count=?, correct_count=?, current_difficulty=? WHERE id=?', [answeredCount, correctCount, nextDifficulty, sessionId]);
    const next = await chooseQuestion(session.examType, nextDifficulty, sessionId);
    if (!next) return json(res, 200, { completed: true, correct, explanation: current.explanation, score: Math.round((correctCount / answeredCount) * 100), progress: { answered: answeredCount, total: session.questionCount } });
    await query('INSERT INTO quiz_session_questions (session_id, question_id, position) VALUES (?, ?, ?)', [sessionId, next.id, answeredCount + 1]);
    return json(res, 200, { completed: false, correct, explanation: current.explanation, progress: { answered: answeredCount, total: session.questionCount }, question: questionView(next) });
  }
  if (req.method === 'GET' && path === '/api/market/services') {
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const filters = ['status = \'published\'']; const values = [];
    if (category) { filters.push('category = ?'); values.push(category); }
    if (search) { filters.push('(title LIKE ? OR description LIKE ?)'); values.push(`%${search}%`, `%${search}%`); }
    const rows = await query(`SELECT id, category, title, description, price, currency, rating, review_count AS reviewCount, created_at AS createdAt FROM marketplace_services WHERE ${filters.join(' AND ')} ORDER BY created_at DESC`, values);
    return json(res, 200, { services: rows });
  }
  if (req.method === 'POST' && path === '/api/market/services') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const category = cleanText(input.category, 80); const title = cleanText(input.title, 255); const description = cleanText(input.description, 2000); const price = Number(input.price);
    if (!category || !title || !description || !Number.isFinite(price) || price <= 0) return json(res, 400, { error: 'INVALID_SERVICE' });
    await query('INSERT INTO marketplace_services (seller_id, category, title, description, price, currency) VALUES (?, ?, ?, ?, ?, ?)', [user.id, category, title, description, price, cleanText(input.currency || 'SAR', 8)]);
    return json(res, 201, { ok: true, message: 'تم إرسال الخدمة للمراجعة.' });
  }
  if (req.method === 'GET' && path === '/api/market/orders') {
    const user = await requireUser(req, res); if (!user) return;
    const rows = await query(`SELECT o.id, o.amount, o.currency, o.status, o.escrow_status AS escrowStatus, o.buyer_note AS buyerNote, o.delivery_note AS deliveryNote, o.created_at AS createdAt, s.title AS serviceTitle
      FROM marketplace_orders o JOIN marketplace_services s ON s.id=o.service_id WHERE o.buyer_id=? OR o.seller_id=? ORDER BY o.created_at DESC`, [user.id, user.id]);
    return json(res, 200, { orders: rows });
  }
  if (req.method === 'POST' && path === '/api/market/orders') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const serviceId = Number(input.serviceId); const buyerNote = cleanText(input.buyerNote, 2000);
    const services = await query('SELECT id, seller_id AS sellerId, price, currency, status FROM marketplace_services WHERE id=?', [serviceId]);
    const service = services[0]; if (!service || service.status !== 'published') return json(res, 404, { error: 'SERVICE_NOT_FOUND' });
    if (Number(service.sellerId) === Number(user.id)) return json(res, 400, { error: 'CANNOT_ORDER_OWN_SERVICE' });
    const result = await query('INSERT INTO marketplace_orders (buyer_id, seller_id, service_id, amount, currency, buyer_note) VALUES (?, ?, ?, ?, ?, ?)', [user.id, service.sellerId || null, service.id, service.price, service.currency, buyerNote || null]);
    return json(res, 201, { orderId: result.insertId, status: 'awaiting_payment', escrowStatus: 'unfunded', message: 'تم إنشاء الطلب. لم يتم تحصيل أي مبلغ؛ الدفع التجريبي غير مفعّل بعد.' });
  }
  if (req.method === 'POST' && path.match(/^\/api\/market\/orders\/\d+\/cancel$/)) {
    const user = await requireUser(req, res); if (!user) return;
    const orderId = Number(path.split('/')[4]);
    const result = await query('UPDATE marketplace_orders SET status=\'cancelled\' WHERE id=? AND buyer_id=? AND status=\'awaiting_payment\'', [orderId, user.id]);
    return json(res, result.affectedRows ? 200 : 409, result.affectedRows ? { ok: true, message: 'تم إلغاء الطلب.' } : { error: 'ORDER_NOT_CANCELLABLE' });
  }
  if (req.method === 'GET' && path === '/api/admin/overview') {
    const admin = await requireRole(req, res, ['admin', 'teacher']); if (!admin) return;
    const [users, courses, enrollments, orders] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM users'), query('SELECT COUNT(*) AS count FROM courses WHERE status=\'published\''), query('SELECT COUNT(*) AS count FROM enrollments'), query('SELECT COUNT(*) AS count FROM marketplace_orders WHERE status NOT IN (\'cancelled\', \'completed\')')
    ]);
    return json(res, 200, { role: admin.role, metrics: { users: users[0].count, courses: courses[0].count, enrollments: enrollments[0].count, openOrders: orders[0].count } });
  }
  if (req.method === 'GET' && path === '/api/admin/users') {
    const admin = await requireRole(req, res, ['admin']); if (!admin) return;
    const rows = await query('SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 100');
    return json(res, 200, { users: rows });
  }
  if (req.method === 'POST' && path === '/api/admin/courses') {
    const admin = await requireRole(req, res, ['admin', 'teacher']); if (!admin) return;
    const input = await body(req); const slug = cleanText(input.slug, 191).toLowerCase().replace(/[^a-z0-9-]/g, '-'); const title = cleanText(input.title, 255); const track = cleanText(input.track, 80); const systemName = cleanText(input.systemName || 'عام', 80); const stage = cleanText(input.stage || 'كل المراحل', 80); const subject = cleanText(input.subject || 'عام', 80); const contentType = cleanText(input.contentType || 'درس', 80); const description = cleanText(input.description, 2000);
    if (!slug || !title || !track || !description) return json(res, 400, { error: 'INVALID_COURSE' });
    await query('INSERT INTO courses (slug, title, track, system_name, stage, subject, content_type, description, lessons_count, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)', [slug, title, track, systemName, stage, subject, contentType, description, cleanText(input.level || 'متوسط', 80)]);
    await query('INSERT INTO admin_audit_logs (actor_id, action, entity_type, metadata_json) VALUES (?, ?, ?, ?)', [admin.id, 'course.created', 'course', JSON.stringify({ slug })]);
    return json(res, 201, { ok: true, slug });
  }
  if (req.method === 'POST' && path.match(/^\/api\/admin\/courses\/\d+\/lessons$/)) {
    const admin = await requireRole(req, res, ['admin', 'teacher']); if (!admin) return;
    const courseId = Number(path.split('/')[4]); const input = await body(req); const title = cleanText(input.title, 255); const duration = Math.max(1, Number(input.durationMinutes || 10)); const position = Math.max(1, Number(input.position || 1)); const content = cleanText(input.content, 5000);
    if (!title) return json(res, 400, { error: 'INVALID_LESSON' });
    await query('INSERT INTO lessons (course_id, title, duration_minutes, position, content) VALUES (?, ?, ?, ?, ?)', [courseId, title, duration, position, content || null]);
    await query('UPDATE courses SET lessons_count=(SELECT COUNT(*) FROM lessons WHERE course_id=?) WHERE id=?', [courseId, courseId]);
    return json(res, 201, { ok: true });
  }
  if (req.method === 'PATCH' && path.match(/^\/api\/admin\/services\/\d+$/)) {
    const admin = await requireRole(req, res, ['admin']); if (!admin) return;
    const serviceId = Number(path.split('/')[4]); const input = await body(req); const status = ['published', 'pending', 'rejected', 'archived'].includes(input.status) ? input.status : null;
    if (!status) return json(res, 400, { error: 'INVALID_STATUS' });
    await query('UPDATE marketplace_services SET status=? WHERE id=?', [status, serviceId]);
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/ai/chat') {
    const user = await requireUser(req, res); if (!user) return;
    const input = await body(req); const message = cleanText(input.message, 4000); const context = cleanText(input.context || 'الدرس الحالي', 255);
    if (!message) return json(res, 400, { error: 'MESSAGE_REQUIRED' });
    await query('INSERT INTO ai_messages (user_id, role, content, context_label) VALUES (?, \'user\', ?, ?)', [user.id, message, context]);
    const recent = await query('SELECT role, content FROM ai_messages WHERE user_id=? ORDER BY id DESC LIMIT 12', [user.id]);
    const response = await fetch(`${process.env.MANUS_API_URL}/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.MANUS_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'system', content: 'أنت مساعد تربوي عربي في منصة إتقان. استخدم أسلوبًا سقراطيًا: لا تعطِ الحل النهائي مباشرة، اطرح سؤالًا صغيرًا، واشرح بلغة مشجعة. اربط الإجابة بالسياق التعليمي عند توفره.' }, ...recent.reverse(), { role: 'user', content: `السياق: ${context}\nسؤال الطالب: ${message}` }] }) });
    if (!response.ok) return json(res, 502, { error: 'AI_UNAVAILABLE', message: 'المساعد مشغول مؤقتًا، حاول بعد لحظات.' });
    const result = await response.json(); const answer = result?.choices?.[0]?.message?.content;
    if (!answer) return json(res, 502, { error: 'AI_EMPTY_RESPONSE' });
    await query('INSERT INTO ai_messages (user_id, role, content, context_label) VALUES (?, \'assistant\', ?, ?)', [user.id, answer, context]);
    return json(res, 200, { answer, context });
  }
  return json(res, 404, { error: 'API_NOT_FOUND' });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = normalize(requested).replace(/^([.][.][/\\])+/, '');
  const candidates = [join(root, safePath), join(root, 'public', safePath)];
  const invalid = candidates.some((candidate) => !candidate.startsWith(root));
  if (invalid) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    let filePath = null;
    for (const candidate of candidates) {
      try { const info = await stat(candidate); if (info.isFile()) { filePath = candidate; break; } } catch { /* try next root */ }
    }
    if (!filePath) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    createReadStream(filePath).pipe(res);
  } catch {
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'NOT_FOUND' });
    const html = await readFile(join(root, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(html);
  }
}

const server = (await import('node:http')).createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (error) {
    console.error('request error', error);
    json(res, error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 500, { error: error.code || 'INTERNAL_ERROR', message: 'حدث خطأ غير متوقع.' });
  }
});

const dbState = await initDatabase();
console.log(`database: ${dbState.ok ? 'ready' : dbState.reason}`);
server.listen(port, '0.0.0.0', () => console.log(`ITQAN full app listening on ${port}`));
