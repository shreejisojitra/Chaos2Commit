/**
 * AI Solution Builder — Enhanced Server
 * Serves both the original builder files and the new enhanced dynamic UI pages,
 * while preserving all existing backend APIs and module features.
 */

try { require('dotenv').config({ override: true }); } catch (_) {}

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const db = require('./db');
const aiService = require('./ai-service');
const generator = require('./generator');
const projectStore = require('./project-store');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PORT = process.env.PORT || config.port || 3847;

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const BUILDER_FILES = new Set([
  'index.html', 'dashboard.html', 'project.html', 'admin.html',
  'index-enhanced.html', 'dashboard-enhanced.html', 'project-enhanced.html', 'admin-enhanced.html',
  'dynamic-theme.css', 'chaos-engine.js'
]);

// Load enabled modules
function loadEnabledModules() {
  const enabledPath = path.join(__dirname, 'modules', 'enabled.json');
  let ids = [];
  try { ids = JSON.parse(fs.readFileSync(enabledPath, 'utf8')); } catch (_) { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  const loaded = [];
  ids.forEach((id) => {
    try {
      delete require.cache[require.resolve(path.join(__dirname, 'modules', id + '.js'))];
      const mod = require(path.join(__dirname, 'modules', id + '.js'));
      loaded.push(mod);
    } catch (_) {}
  });
  return loaded;
}
let enabledModules = loadEnabledModules();

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

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { reject(new Error('Request body too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // Health
    if (method === 'GET' && pathname === '/api/health') {
      const aiConfigured = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your-groq-api-key-here') ||
                           !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') ||
                           !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here');
      return sendJson(res, 200, { ok: true, app: 'AI Solution Builder Enhanced', version: '2.0.0', aiConfigured });
    }

    // Builder Files (both original and enhanced)
    if (method === 'GET' && pathname.startsWith('/builder/')) {
      const file = pathname.slice('/builder/'.length);
      if (!BUILDER_FILES.has(file)) return sendJson(res, 404, { error: 'Not found' });
      return serveStaticFile(res, path.join(FRONTEND_DIR, file));
    }

    // Project Persistence
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

    // AI Consultant
    if (method === 'POST' && pathname === '/api/ai/chat') {
      const body = await readBody(req, 200_000);
      try {
        const analysis = await aiService.analyze({
          message: body.message,
          conversation: body.conversation,
          projectContext: body.projectContext,
        });
        return sendJson(res, 200, { message: analysis.businessUnderstanding, analysis, source: 'ai' });
      } catch (err) {
        return sendJson(res, 502, { error: err.message });
      }
    }

    // AI Blueprint
    if (method === 'POST' && pathname === '/api/ai/blueprint') {
      const body = await readBody(req, 200_000);
      try {
        const blueprint = await aiService.generateBlueprint({
          projectContext: body.projectContext,
          consultantAnalysis: body.consultantAnalysis
        });
        return sendJson(res, 200, { blueprint });
      } catch (err) {
        return sendJson(res, 502, { error: err.message });
      }
    }

    // AI Architecture
    if (method === 'POST' && pathname === '/api/ai/architecture') {
      const body = await readBody(req, 200_000);
      try {
        const architecture = await aiService.generateArchitecture({ blueprint: body.blueprint });
        return sendJson(res, 200, { architecture });
      } catch (err) {
        return sendJson(res, 502, { error: err.message });
      }
    }

    // Default redirect to enhanced dashboard if /builder is hit
    if (method === 'GET' && pathname === '/builder') {
      res.writeHead(302, { Location: '/builder/dashboard-enhanced.html' });
      return res.end();
    }

    // Serve public generated files or static frontend root files
    if (method === 'GET') {
      const publicPath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname.slice(1));
      if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        return serveStaticFile(res, publicPath);
      }
      // Also fallback to frontend dir
      const frontendPath = path.join(FRONTEND_DIR, pathname === '/' ? 'index-enhanced.html' : pathname.slice(1));
      if (fs.existsSync(frontendPath) && fs.statSync(frontendPath).isFile()) {
        return serveStaticFile(res, frontendPath);
      }
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Chaos2Commit — Enhanced AI Solution Builder Running`);
  console.log(`   Enhanced Dashboard: http://127.0.0.1:${PORT}/builder/dashboard-enhanced.html`);
  console.log(`   Enhanced Workspace: http://127.0.0.1:${PORT}/builder/project-enhanced.html`);
  console.log(`   Enhanced Admin:     http://127.0.0.1:${PORT}/builder/admin-enhanced.html`);
  console.log(`   Original Dashboard: http://127.0.0.1:${PORT}/builder/dashboard.html\n`);
});
