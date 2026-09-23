/**
 * AI Solution Builder — Server
 * Serves both the builder UI and the generated application.
 * All pipeline API calls (consultant, blueprint, architecture, generate, modify, deploy) are handled here.
 */

// Load .env file — override=true ensures .env always wins over stale system env vars
try { require('dotenv').config({ override: true }); } catch (_) {}

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const db = require('./db');
const builderDb = require('./builder-db');
const aiService = require('./ai-service');
const generator = require('./generator');
const projectStore = require('./project-store');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PORT = process.env.PORT || config.port || 3847;
const SESSION_SECRET = process.env.SESSION_SECRET || 'asb-generated-app-secret';

// Builder HTML files served at /builder/<file>
// In separated structure: frontend/ is sibling of backend/
const BUILDER_FILES = new Set(['index.html', 'dashboard.html', 'project.html', 'admin.html']);
const FRONTEND_DIR  = path.join(__dirname, '..', 'frontend');

// ─── Incremental feature modules ─────────────────────────────────────────────
function loadEnabledModules() {
  const enabledPath = path.join(__dirname, 'modules', 'enabled.json');
  let ids = [];
  try { ids = JSON.parse(fs.readFileSync(enabledPath, 'utf8')); } catch (_) { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  const loaded = [];
  ids.forEach((id) => {
    try {
      // Clear require cache so hot module reloading works after generate
      delete require.cache[require.resolve(path.join(__dirname, 'modules', id + '.js'))];
      const mod = require(path.join(__dirname, 'modules', id + '.js'));
      loaded.push(mod);
      console.log('[modules] Loaded:', mod.name || id);
    } catch (e) {
      console.warn('[modules] Failed to load', id, e.message);
    }
  });
  return loaded;
}
let enabledModules = loadEnabledModules();

// ─── Rate limiting for AI calls ───────────────────────────────────────────────
const aiRequestCounts = new Map();
function checkAiRateLimit(ip) {
  const now = Date.now();
  const recent = aiRequestCounts.get(ip) || { startedAt: now, count: 0 };
  if (now - recent.startedAt > 60_000) { recent.startedAt = now; recent.count = 0; }
  if (recent.count >= 30) return false;
  recent.count += 1;
  aiRequestCounts.set(ip, recent);
  if (aiRequestCounts.size > 1000) {
    for (const [k, v] of aiRequestCounts) if (now - v.startedAt > 60_000) aiRequestCounts.delete(k);
  }
  return true;
}

// ─── Sessions (generated app) ──────────────────────────────────────────────────
const sessions = new Map();

// ─── Builder sessions (platform auth) ─────────────────────────────────────────
const builderSessions = new Map();

function getBuilderSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.bsid;
  if (!sid || !builderSessions.has(sid)) return null;
  return { sid, data: builderSessions.get(sid) };
}

function setBuilderSession(res, sid, data) {
  builderSessions.set(sid, data);
  res.setHeader('Set-Cookie',
    `bsid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
  );
}

function clearBuilderSession(res, sid) {
  if (sid) builderSessions.delete(sid);
  res.setHeader('Set-Cookie', 'bsid=; Path=/; HttpOnly; Max-Age=0');
}

function requireBuilderAuth(req, res) {
  const sess = getBuilderSession(req);
  if (!sess || !sess.data.userId) {
    sendJson(res, 401, { error: 'Builder authentication required', redirect: '/builder/login.html' });
    return null;
  }
  return sess;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('=') || '');
  });
  return out;
}

function sessionId() { return crypto.randomBytes(24).toString('hex'); }

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.sid;
  if (!sid || !sessions.has(sid)) return null;
  return { sid, data: sessions.get(sid) };
}

function setSession(res, sid, data) {
  sessions.set(sid, data);
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
}

function clearSession(res, sid) {
  if (sid) sessions.delete(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Max-Age=0');
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function sendJsonStream(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes && !rejected) {
        rejected = true;
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (rejected) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, filePath) {
  const full = path.resolve(filePath);
  const root = path.resolve(path.join(__dirname, 'public'));
  if (!full.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) { res.writeHead(404); return res.end('Not found'); }
  const ext = path.extname(full).toLowerCase();
  const data = fs.readFileSync(full);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': data.length });
  res.end(data);
}

function serveBuilderStatic(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { res.writeHead(404); return res.end('Not found'); }
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.js' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length, 'Cache-Control': 'no-store' });
  res.end(data);
}

function requireAuth(req, res) {
  const sess = getSession(req);
  if (!sess || !sess.data.userId) { sendJson(res, 401, { error: 'Authentication required' }); return null; }
  return sess;
}

// ─── Main request handler ─────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS for same-origin builder pages
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // ── Health ──────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/health') {
      const cfg = readCurrentConfig();
      const aiConfigured = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your-groq-api-key-here') ||
                           !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') ||
                           !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here');
      return sendJson(res, 200, { ok: true, app: cfg.appName, version: cfg.version, aiConfigured });
    }

    // ── App config (public) ─────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/config') {
      const cfg = readCurrentConfig();
      return sendJson(res, 200, {
        appName: cfg.appName,
        version: cfg.version,
        modules: enabledModules.map((m) => m.id || m.name),
        businessName: cfg.businessName || '',
      });
    }

    // ── Builder Auth ─────────────────────────────────────────────────────────
    if (pathname.startsWith('/api/builder/auth')) {
      if (method === 'POST' && pathname === '/api/builder/auth/register') {
        const body = await readBody(req);
        const name     = String(body.name     || '').trim();
        const email    = String(body.email    || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!name || !email || !password)
          return sendJson(res, 400, { error: 'Name, email and password required' });
        if (password.length < 6)
          return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
        try {
          const user = builderDb.createUser({ name, email, password });
          const sid  = sessionId();
          setBuilderSession(res, sid, { userId: user.id, email: user.email, name: user.name });
          return sendJson(res, 201, builderDb.getPublic(user));
        } catch (err) {
          return sendJson(res, err.status || 400, { error: err.message });
        }
      }

      if (method === 'POST' && pathname === '/api/builder/auth/login') {
        const body = await readBody(req);
        const email    = String(body.email    || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !password)
          return sendJson(res, 400, { error: 'Email and password required' });
        const user = builderDb.getUserByEmail(email);
        if (!user || !builderDb.verifyPassword(password, user.password_hash))
          return sendJson(res, 401, { error: 'Invalid email or password' });
        const sid = sessionId();
        setBuilderSession(res, sid, { userId: user.id, email: user.email, name: user.name });
        return sendJson(res, 200, builderDb.getPublic(user));
      }

      if (method === 'POST' && pathname === '/api/builder/auth/logout') {
        const sess = getBuilderSession(req);
        clearBuilderSession(res, sess?.sid);
        return sendJson(res, 200, { ok: true });
      }

      if (method === 'GET' && pathname === '/api/builder/auth/me') {
        const sess = getBuilderSession(req);
        if (!sess) return sendJson(res, 401, { error: 'Not authenticated', redirect: '/builder/login.html' });
        const user = builderDb.getUserById(sess.data.userId);
        if (!user) return sendJson(res, 401, { error: 'User not found' });
        return sendJson(res, 200, builderDb.getPublic(user));
      }
    }

    // ── Builder pages ────────────────────────────────────────────────────────
    if (method === 'GET' && pathname.startsWith('/builder/')) {
      const file = pathname.slice('/builder/'.length);

      // Public pages (no auth needed)
      const PUBLIC_BUILDER = new Set(['login.html', 'register.html', 'config.js']);
      if (file === 'config.js') return serveBuilderStatic(res, path.join(FRONTEND_DIR, 'config.js'));
      if (PUBLIC_BUILDER.has(file)) return serveBuilderStatic(res, path.join(FRONTEND_DIR, file));

      // Protected pages — redirect to login if not authenticated
      const sess = getBuilderSession(req);
      if (!sess) {
        res.writeHead(302, { Location: '/builder/login.html' });
        return res.end();
      }

      if (!BUILDER_FILES.has(file)) return sendJson(res, 404, { error: 'Not found' });
      return serveBuilderStatic(res, path.join(FRONTEND_DIR, file));
    }

    // ── Project store (server-side persistence) ──────────────────────────────
    if (pathname.startsWith('/api/projects')) {
      if (method === 'GET' && pathname === '/api/projects') {
        return sendJson(res, 200, projectStore.list());
      }

      if (method === 'POST' && pathname === '/api/projects') {
        const body = await readBody(req);
        if (!body.id) return sendJson(res, 400, { error: 'Project id required' });
        const saved = projectStore.upsert(body);
        return sendJson(res, 200, saved);
      }

      const match = pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        if (method === 'GET') {
          const p = projectStore.get(id);
          if (!p) return sendJson(res, 404, { error: 'Project not found' });
          return sendJson(res, 200, p);
        }
        if (method === 'PUT') {
          const body = await readBody(req);
          const saved = projectStore.upsert({ ...body, id });
          return sendJson(res, 200, saved);
        }
        if (method === 'DELETE') {
          projectStore.delete(id);
          return sendJson(res, 200, { ok: true });
        }
      }
    }

    // ── AI Consultant chat ───────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/ai/chat') {
      const builderSess = requireBuilderAuth(req, res);
      if (!builderSess) return;
      const ip = req.socket.remoteAddress || 'unknown';
      if (!checkAiRateLimit(ip)) return sendJson(res, 429, { error: 'Too many requests. Please wait a minute.' });

      const body = await readBody(req, 200_000);
      const projectId = String(body.projectId || '').trim();
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!projectId || projectId.length > 120) return sendJson(res, 400, { error: 'A valid projectId is required.' });
      if (!message || message.length > aiService.MAX_MESSAGE_LENGTH) {
        return sendJson(res, 400, { error: `Message must be 1–${aiService.MAX_MESSAGE_LENGTH} characters.` });
      }
      try {
        const analysis = await aiService.analyze({
          message,
          conversation: body.conversation,
          projectContext: body.projectContext,
        });
        // Auto-save conversation to project store
        if (body.projectId && body.fullConversation) {
          const p = projectStore.get(body.projectId);
          if (p) {
            p.consultantConversation = body.fullConversation;
            p.consultant = analysis;
            projectStore.upsert(p);
          }
        }
        return sendJson(res, 200, { message: analysis.businessUnderstanding, analysis, source: 'openai' });
      } catch (err) {
        const status = err.status || 502;
        console.error('[ai/chat error]', err.message);
        return sendJson(res, status, { error: err.message });
      }
    }

    // ── AI Blueprint ─────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/ai/blueprint') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!checkAiRateLimit(ip)) return sendJson(res, 429, { error: 'Too many requests.' });

      const body = await readBody(req, 200_000);
      const { projectId, projectContext, consultantAnalysis } = body;
      if (!projectId) return sendJson(res, 400, { error: 'projectId required' });
      try {
        const blueprint = await aiService.generateBlueprint({ projectContext, consultantAnalysis });
        // Persist to project
        const p = projectStore.get(projectId) || { id: projectId };
        p.blueprint = blueprint;
        p.progress = p.progress || {};
        p.progress.blueprint = true;
        p.status = 'blueprint';
        projectStore.upsert(p);
        return sendJson(res, 200, { blueprint });
      } catch (err) {
        console.error('[ai/blueprint error]', err.message);
        return sendJson(res, err.status || 502, { error: err.message });
      }
    }

    // ── AI Architecture ──────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/ai/architecture') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!checkAiRateLimit(ip)) return sendJson(res, 429, { error: 'Too many requests.' });

      const body = await readBody(req, 200_000);
      const { projectId, blueprint } = body;
      if (!projectId || !blueprint) return sendJson(res, 400, { error: 'projectId and blueprint required' });
      try {
        const architecture = await aiService.generateArchitecture({ blueprint });
        const p = projectStore.get(projectId) || { id: projectId };
        p.architecture = architecture;
        p.progress = p.progress || {};
        p.progress.architecture = true;
        p.status = 'architecture';
        projectStore.upsert(p);
        return sendJson(res, 200, { architecture });
      } catch (err) {
        console.error('[ai/architecture error]', err.message);
        return sendJson(res, err.status || 502, { error: err.message });
      }
    }

    // ── AI Generate App ──────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/ai/generate') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!checkAiRateLimit(ip)) return sendJson(res, 429, { error: 'Too many requests.' });

      const body = await readBody(req, 200_000);
      const { projectId, blueprint } = body;
      if (!projectId || !blueprint) return sendJson(res, 400, { error: 'projectId and blueprint required' });
      try {
        // 1. Get generation spec from AI
        const spec = await aiService.generateAppSpec({ blueprint });

        // 2. Write actual files on disk
        const result = generator.generateApp(spec, projectId);

        // 3. Reload modules so the new app is live without restart
        enabledModules = loadEnabledModules();

        // 4. Update project
        const p = projectStore.get(projectId) || { id: projectId };
        p.generationSpec = spec;
        p.progress = p.progress || {};
        p.progress.build = true;
        p.status = 'generated';
        p.versions = p.versions || [];
        p.versions.unshift({
          version: result.version,
          changes: 'Initial application generated from blueprint',
          files: result.files,
          at: result.at,
          status: 'ok',
        });
        projectStore.upsert(p);

        return sendJson(res, 200, {
          spec,
          version: result.version,
          files: result.files,
          appUrl: `http://127.0.0.1:${PORT}`,
          message: `App generated as v${result.version}. Running at http://127.0.0.1:${PORT}`,
        });
      } catch (err) {
        console.error('[generate]', err);
        return sendJson(res, err.status || 500, { error: err.message });
      }
    }

    // ── AI Modify ────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/ai/modify') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!checkAiRateLimit(ip)) return sendJson(res, 429, { error: 'Too many requests.' });

      const body = await readBody(req, 200_000);
      const { projectId, request: modRequest, currentSpec, currentBlueprint } = body;
      if (!projectId || !modRequest) return sendJson(res, 400, { error: 'projectId and request required' });

      try {
        // 1. Analyze the modification
        const plan = await aiService.analyzeModification({ request: modRequest, currentSpec, currentBlueprint });
        return sendJson(res, 200, { plan });
      } catch (err) {
        return sendJson(res, err.status || 502, { error: err.message });
      }
    }

    if (method === 'POST' && pathname === '/api/ai/modify/apply') {
      const body = await readBody(req, 200_000);
      const { projectId, plan, currentSpec } = body;
      if (!projectId || !plan) return sendJson(res, 400, { error: 'projectId and plan required' });
      try {
        const result = generator.applyModification(plan, currentSpec, projectId);
        // Reload modules
        enabledModules = loadEnabledModules();

        const p = projectStore.get(projectId) || { id: projectId };
        p.progress = p.progress || {};
        p.status = 'modified';
        p.versions = p.versions || [];
        p.versions.unshift({
          version: result.version,
          changes: plan.summary || 'Modification applied',
          files: result.files,
          at: result.at,
          status: 'ok',
        });
        // Merge new modules into spec
        if (p.generationSpec && Array.isArray(plan.newModules)) {
          plan.newModules.forEach((m) => {
            if (!p.generationSpec.modules.includes(m)) p.generationSpec.modules.push(m);
          });
        }
        projectStore.upsert(p);

        return sendJson(res, 200, {
          version: result.version,
          files: result.files,
          appUrl: `http://127.0.0.1:${PORT}`,
          message: `Modification applied as v${result.version}`,
        });
      } catch (err) {
        console.error('[modify/apply]', err);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // ── Deploy ───────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/deploy') {
      const body = await readBody(req);
      const { projectId } = body;
      if (!projectId) return sendJson(res, 400, { error: 'projectId required' });

      const p = projectStore.get(projectId);
      if (!p || !p.progress?.build) return sendJson(res, 400, { error: 'App must be generated before deploying' });

      const cfg = readCurrentConfig();
      const deployId = crypto.randomBytes(6).toString('hex');
      const deployment = {
        id: deployId,
        projectId,
        appName: cfg.appName,
        version: cfg.version,
        url: `http://127.0.0.1:${PORT}`,
        status: 'running',
        platform: 'local',
        deployedAt: new Date().toISOString(),
        note: 'Running locally. For production deployment, export the generated-app directory to Render, Railway, or Vercel + serverless adapter.',
      };

      p.deployment = deployment;
      p.progress.deployed = true;
      p.status = 'deployed';
      projectStore.upsert(p);

      return sendJson(res, 200, deployment);
    }

    // ── Versions (changelog) ─────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/versions') {
      const projectId = url.searchParams.get('projectId');
      let log = [];
      try { log = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'changelog.json'), 'utf8')); } catch (_) {}
      if (!Array.isArray(log)) log = [];
      if (projectId) log = log.filter((e) => !e.projectId || e.projectId === projectId);
      return sendJson(res, 200, log);
    }

    // ── Auth routes ──────────────────────────────────────────────────────────
    if (pathname.startsWith('/api/auth')) {
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });
        const user = db.getUserByEmail(email);
        if (!user || !db.verifyPassword(password, user.password_hash)) {
          return sendJson(res, 401, { error: 'Invalid email or password' });
        }
        const sid = sessionId();
        setSession(res, sid, { userId: user.id, email: user.email, name: user.name, role: user.role });
        return sendJson(res, 200, { id: user.id, email: user.email, name: user.name, role: user.role });
      }
      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const name = String(body.name || '').trim();
        if (!email || !password || !name) return sendJson(res, 400, { error: 'Name, email, password required' });
        if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
        if (db.getUserByEmail(email)) return sendJson(res, 409, { error: 'Email already registered' });
        const user = db.createUser({ email, password_hash: db.hashPassword(password), name, role: 'user' });
        const sid = sessionId();
        setSession(res, sid, { userId: user.id, email: user.email, name: user.name, role: user.role });
        return sendJson(res, 201, { id: user.id, email: user.email, name: user.name, role: user.role });
      }
      if (method === 'POST' && pathname === '/api/auth/logout') {
        const sess = getSession(req);
        clearSession(res, sess && sess.sid);
        return sendJson(res, 200, { ok: true });
      }
      if (method === 'GET' && pathname === '/api/auth/me') {
        const sess = getSession(req);
        if (!sess || !sess.data.userId) return sendJson(res, 401, { error: 'Not authenticated' });
        const user = db.getUserById(sess.data.userId);
        if (!user) return sendJson(res, 401, { error: 'User not found' });
        return sendJson(res, 200, { id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at });
      }
    }

    // ── Parse body once (non-GET/HEAD) for module dispatch + records ────────
    // IMPORTANT: req body stream can only be read once. We read it here for
    // paths that aren't already handled above with their own readBody calls.
    let parsedBody = null;
    async function getBody() {
      if (parsedBody !== null) return parsedBody;
      parsedBody = await readBody(req, 2_000_000).catch(() => ({}));
      return parsedBody;
    }

    // ── Module dispatch (attendance, etc.) ───────────────────────────────────
    for (const mod of enabledModules) {
      if (typeof mod.handleRequest === 'function') {
        const body = (method === 'GET' || method === 'HEAD') ? {} : await getBody();
        const handled = mod.handleRequest({
          method, pathname, url,
          sess: getSession(req),
          body,
          sendJson: (status, data) => sendJson(res, status, data),
        });
        if (handled) return;
      }
    }

    // ── Records CRUD ──────────────────────────────────────────────────────────
    if (pathname.startsWith('/api/records')) {
      if (method === 'GET' && pathname === '/api/records') {
        const sess = requireAuth(req, res); if (!sess) return;
        const q = url.searchParams.get('q') || undefined;
        const status = url.searchParams.get('status') || undefined;
        const all = db.listRecords({ q, status });
        // Admins see all; regular users see only their own
        const rows = sess.data.role === 'admin' ? all : all.filter((r) => r.owner_id === sess.data.userId);
        return sendJson(res, 200, rows);
      }
      const one = pathname.match(/^\/api\/records\/(\d+)$/);
      if (one) {
        const id = one[1];
        const sess = requireAuth(req, res); if (!sess) return;
        if (method === 'GET') {
          const existing = db.getRecord(id);
          if (!existing) return sendJson(res, 404, { error: 'Record not found' });
          if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) return sendJson(res, 403, { error: 'Forbidden' });
          return sendJson(res, 200, existing);
        }
        if (method === 'PUT') {
          const existing = db.getRecord(id);
          if (!existing) return sendJson(res, 404, { error: 'Record not found' });
          if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) return sendJson(res, 403, { error: 'You can only edit your own records' });
          const body = await getBody();
          const title = body.title !== undefined ? String(body.title).trim() : existing.title;
          const description = body.description !== undefined ? String(body.description).trim() : existing.description;
          // Accept any status — domain apps use custom status values
          const status = body.status !== undefined ? String(body.status).trim() : existing.status;
          if (!title) return sendJson(res, 400, { error: 'Title is required' });
          // Passthrough extra domain fields
          const extraFields = {};
          Object.keys(body).forEach(k => {
            if (!['title', 'description', 'status', 'id', 'owner_id', 'created_at', 'updated_at'].includes(k)) {
              extraFields[k] = String(body[k] ?? '').slice(0, 2000);
            }
          });
          return sendJson(res, 200, db.updateRecord(existing.id, { title, description, status, ...extraFields }));
        }
        if (method === 'DELETE') {
          const existing = db.getRecord(id);
          if (!existing) return sendJson(res, 404, { error: 'Record not found' });
          if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) return sendJson(res, 403, { error: 'Forbidden' });
          db.deleteRecord(existing.id);
          return sendJson(res, 200, { ok: true, id: existing.id });
        }
      }
      if (method === 'POST' && pathname === '/api/records') {
        const sess = requireAuth(req, res); if (!sess) return;
        const body = await getBody();
        const title = String(body.title || '').trim();
        if (!title) return sendJson(res, 400, { error: 'Title is required' });
        const description = String(body.description || '').trim();
        // Accept any status value — generated apps use domain-specific statuses
        const status = String(body.status || 'new').trim() || 'new';
        // Passthrough all extra domain fields from the spec
        const extraFields = {};
        Object.keys(body).forEach((k) => {
          if (!['title', 'description', 'status', 'owner_id', 'id', 'created_at', 'updated_at'].includes(k)) {
            extraFields[k] = String(body[k] ?? '').slice(0, 2000);
          }
        });
        const row = db.createRecord({ title, description, status, owner_id: sess.data.userId, ...extraFields });
        return sendJson(res, 201, row);
      }
    }

    // ── Generated app pages ──────────────────────────────────────────────────
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const sess = getSession(req);
      if (!sess || !sess.data.userId) { res.writeHead(302, { Location: '/login.html' }); return res.end(); }
      return serveStatic(req, res, path.join(__dirname, 'public', 'index.html'));
    }
    if (method === 'GET') {
      const safePath = pathname === '/' ? '/index.html' : pathname;
      // Check if file exists first, else serve 404 page
      const fullPath = path.join(__dirname, 'public', path.normalize(safePath));
      const pubRoot  = path.resolve(path.join(__dirname, 'public'));
      if (!path.resolve(fullPath).startsWith(pubRoot)) { res.writeHead(403); return res.end('Forbidden'); }
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><title>404 Not Found</title>
<style>body{font-family:Inter,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:2.5rem;text-align:center;max-width:420px}
h1{font-size:3rem;font-weight:800;color:#1e3a8a;margin:0}p{color:#64748b;margin:.75rem 0 1.5rem}
a{background:#2563eb;color:#fff;padding:.6rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem}</style></head>
<body><div class="card"><h1>404</h1><p>Page not found.</p><a href="/">Go home</a></div></body></html>`);
      }
      return serveStatic(req, res, fullPath);
    }

    sendJson(res, 404, { error: 'Not found', path: pathname });
  } catch (err) {
    if (err.status === 413) return sendJson(res, 413, { error: 'Request body too large.' });
    console.error('[server error]', err);
    sendJsonStream(res, 500, { error: 'Internal server error', message: err.message });
  }
});

function readCurrentConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (_) { return {}; }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 AI Solution Builder — Backend running at http://127.0.0.1:${PORT}`);
  console.log(`   Builder UI:    http://127.0.0.1:${PORT}/builder/dashboard.html`);
  console.log(`   Generated app: http://127.0.0.1:${PORT}/`);
  console.log(`   Frontend dir:  ${FRONTEND_DIR}`);
  console.log(`   AI configured: ${process.env.OPENAI_API_KEY ? 'YES ✓' : 'NO — set OPENAI_API_KEY in backend/.env'}`);
  console.log(`   Demo login:    admin@example.com / admin123\n`);
});
