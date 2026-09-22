const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const db = require('./db');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PORT = process.env.PORT || config.port || 3847;

// Incremental feature modules (enabled via modules/enabled.json — do not regenerate whole app)
function loadEnabledModules() {
  const enabledPath = path.join(__dirname, 'modules', 'enabled.json');
  let ids = [];
  try {
    ids = JSON.parse(fs.readFileSync(enabledPath, 'utf8'));
  } catch (_) {
    ids = [];
  }
  if (!Array.isArray(ids)) ids = [];
  const loaded = [];
  ids.forEach((id) => {
    try {
      const mod = require(path.join(__dirname, 'modules', id + '.js'));
      loaded.push(mod);
      console.log('Loaded module:', mod.name || id);
    } catch (e) {
      console.warn('Failed to load module', id, e.message);
    }
  });
  return loaded;
}
const enabledModules = loadEnabledModules();

const SESSION_SECRET = process.env.SESSION_SECRET || 'asb-generated-app-secret';

const sessions = new Map();

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('=') || '');
  });
  return out;
}

function sessionId() {
  return crypto.randomBytes(24).toString('hex');
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.sid;
  if (!sid || !sessions.has(sid)) return null;
  return { sid, data: sessions.get(sid) };
}

function setSession(res, sid, data) {
  sessions.set(sid, data);
  res.setHeader(
    'Set-Cookie',
    `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );
}

function clearSession(res, sid) {
  if (sid) sessions.delete(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Max-Age=0');
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
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
  if (!full.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(full).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(full);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
  res.end(data);
}

function requireAuth(req, res) {
  const sess = getSession(req);
  if (!sess || !sess.data.userId) {
    sendJson(res, 401, { error: 'Authentication required' });
    return null;
  }
  return sess;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // Health
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, app: config.appName, version: config.version });
    }

    // Config (public subset)
    if (method === 'GET' && pathname === '/api/config') {
      return sendJson(res, 200, {
        appName: config.appName,
        version: config.version,
        modules: enabledModules.map((m) => m.id || m.name),
      });
    }

    // Auth routes
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
        const user = db.createUser({
          email,
          password_hash: db.hashPassword(password),
          name,
          role: 'user',
        });
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
        return sendJson(res, 200, {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          created_at: user.created_at,
        });
      }
    }

    // Module dispatch (attendance etc.) — path-specific, before generic records
    for (const mod of enabledModules) {
      if (typeof mod.handleRequest === 'function') {
        const body = method === 'GET' || method === 'HEAD' ? {} : await readBody(req).catch(() => ({}));
        const handled = mod.handleRequest({
          method,
          pathname,
          url,
          sess: getSession(req),
          body,
          sendJson: (status, data) => sendJson(res, status, data),
        });
        if (handled) return;
      }
    }

    // Records CRUD
    if (pathname.startsWith('/api/records')) {
      if (method === 'GET' && pathname === '/api/records') {
        const sess = requireAuth(req, res);
        if (!sess) return;
        const all = db.listRecords(sess.data.userId, sess.data.role);
        return sendJson(res, 200, all);
      }

      const one = pathname.match(/^\/api\/records\/(\d+)$/);
      if (one) {
        const id = one[1];
        const sess = requireAuth(req, res);
        if (!sess) return;

        if (method === 'GET') {
          const existing = db.getRecord(id);
          if (!existing) return sendJson(res, 404, { error: 'Record not found' });
          if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) {
            return sendJson(res, 403, { error: 'Forbidden' });
          }
          return sendJson(res, 200, existing);
        }

        if (method === 'PUT') {
          const existing = db.getRecord(id);
          if (!existing) return sendJson(res, 404, { error: 'Record not found' });
          if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) {
            return sendJson(res, 403, { error: 'You can only edit your own records' });
          }
          const body = await readBody(req);
          const title = body.title !== undefined ? String(body.title).trim() : existing.title;
          const description =
            body.description !== undefined ? String(body.description).trim() : existing.description;
          let status = body.status !== undefined ? String(body.status).trim() : existing.status;
          const allowed = new Set(['open', 'in_progress', 'done', 'archived']);
          if (!allowed.has(status)) status = existing.status;
          if (!title) return sendJson(res, 400, { error: 'Title is required' });
          return sendJson(res, 200, db.updateRecord(existing.id, { title, description, status }));
        }

        if (method === 'DELETE') {
          const existing = db.getRecord(id);
          if (!existing) return sendJson(res, 404, { error: 'Record not found' });
          if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) {
            return sendJson(res, 403, { error: 'You can only delete your own records' });
          }
          db.deleteRecord(existing.id);
          return sendJson(res, 200, { ok: true, id: existing.id });
        }
      }

      if (method === 'POST' && pathname === '/api/records') {
        const sess = requireAuth(req, res);
        if (!sess) return;
        const body = await readBody(req);
        const title = String(body.title || '').trim();
        const description = String(body.description || '').trim();
        let status = String(body.status || 'open').trim();
        const allowed = new Set(['open', 'in_progress', 'done', 'archived']);
        if (!allowed.has(status)) status = 'open';
        if (!title) return sendJson(res, 400, { error: 'Title is required' });
        const row = db.createRecord({
          title,
          description,
          status,
          owner_id: sess.data.userId,
        });
        return sendJson(res, 201, row);
      }
    }

    // Pages
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const sess = getSession(req);
      if (!sess || !sess.data.userId) {
        res.writeHead(302, { Location: '/login.html' });
        return res.end();
      }
      return serveStatic(req, res, path.join(__dirname, 'public', 'index.html'));
    }

    if (method === 'GET') {
      const safePath = pathname === '/' ? '/index.html' : pathname;
      return serveStatic(req, res, path.join(__dirname, 'public', path.normalize(safePath)));
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Generated app "${config.appName}" running at http://127.0.0.1:${PORT}`);
  console.log('Demo: admin@example.com / admin123');
});
