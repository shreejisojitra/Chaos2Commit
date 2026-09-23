/**
 * Generator Engine v2 — Fully data-driven
 *
 * Every generated app is unique per business domain.
 * Layout, colors, statuses, fields, nav, stats, sample data
 * all come from the AI spec — nothing is hardcoded.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;

// ─── File helpers ─────────────────────────────────────────────────────────────

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}
function readJson(rel, fb) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (_) { return fb; }
}
function writeJson(rel, data) {
  write(rel, JSON.stringify(data, null, 2));
}
function bumpVersion(v) {
  const parts = String(v || '1.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2]++;
  return parts.join('.');
}

// ─── Safe helpers ─────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cap(s) {
  return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1).replace(/_/g, ' ');
}
function safeId(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ─── Normalise spec — fill in gaps AI might leave ─────────────────────────────

function normalise(raw) {
  const s = Object.assign({}, raw);

  s.appName          = String(s.appName || 'App').slice(0, 60);
  s.businessName     = String(s.businessName || '').slice(0, 60);
  s.entityName       = String(s.entityName || 'Record');
  s.entityNamePlural = String(s.entityNamePlural || s.entityName + 's');
  s.entityIcon       = String(s.entityIcon || '📄');
  s.primaryColor     = /^#[0-9a-f]{6}$/i.test(s.primaryColor) ? s.primaryColor : '#2563eb';
  s.secondaryColor   = /^#[0-9a-f]{6}$/i.test(s.secondaryColor) ? s.secondaryColor : '#7c3aed';
  s.accentColor      = /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : '#eff6ff';

  // Status values — must be non-empty array of strings
  s.statusValues = Array.isArray(s.statusValues) && s.statusValues.length
    ? s.statusValues.map(String)
    : ['new', 'active', 'completed', 'archived'];

  // Status colors — hex per status value
  const defaultStatusColors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#f97316'];
  s.statusColors = {};
  s.statusValues.forEach((sv, i) => {
    s.statusColors[sv] = (raw.statusColors && raw.statusColors[sv]) || defaultStatusColors[i % defaultStatusColors.length];
  });

  // Entity fields — strip id/owner_id/created_at/updated_at/title/status if AI included them
  const RESERVED = new Set(['id', 'owner_id', 'created_at', 'updated_at', 'title', 'status']);
  s.entityFields = Array.isArray(s.entityFields)
    ? s.entityFields.filter(f => f && f.name && !RESERVED.has(f.name)).map(f => ({
        name:     String(f.name),
        label:    String(f.label || cap(f.name)),
        type:     String(f.type || 'text'),
        required: Boolean(f.required),
        icon:     String(f.icon || ''),
      }))
    : [];

  // Dashboard stats
  s.dashboardStats = Array.isArray(s.dashboardStats) && s.dashboardStats.length
    ? s.dashboardStats.slice(0, 4).map(d => ({
        key:    String(d.key || 'total'),
        label:  String(d.label || 'Total'),
        icon:   String(d.icon || '📊'),
        color:  /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : s.primaryColor,
        filter: d.filter || null,
      }))
    : [
        { key: 'total', label: 'Total ' + s.entityNamePlural, icon: '📊', color: s.primaryColor, filter: null },
        { key: s.statusValues[0], label: cap(s.statusValues[0]), icon: '🔵', color: s.primaryColor, filter: s.statusValues[0] },
      ];

  // Nav pages (always include main entity page)
  s.navPages = Array.isArray(s.navPages) && s.navPages.length
    ? s.navPages
    : [{ id: 'dashboard', label: s.entityNamePlural, icon: s.entityIcon, href: '/' }];

  // Ensure the root page is first
  if (!s.navPages.find(p => p.href === '/' || p.id === 'dashboard')) {
    s.navPages.unshift({ id: 'dashboard', label: s.entityNamePlural, icon: s.entityIcon, href: '/' });
  }

  // Extra pages (beyond the main entity list)
  s.extraPages = Array.isArray(s.extraPages) ? s.extraPages : [];

  // Modules
  s.modules = Array.isArray(s.modules) ? s.modules : [];

  // Domain terminology
  const dt = s.domainTerminology || {};
  s.domainTerminology = {
    createBtn:         String(dt.createBtn         || 'New ' + s.entityName),
    editBtn:           String(dt.editBtn           || 'Edit'),
    deleteConfirm:     String(dt.deleteConfirm     || 'Delete this ' + s.entityName.toLowerCase() + '?'),
    searchPlaceholder: String(dt.searchPlaceholder || 'Search ' + s.entityNamePlural.toLowerCase() + '…'),
    emptyState:        String(dt.emptyState        || 'No ' + s.entityNamePlural.toLowerCase() + ' yet.'),
    listTitle:         String(dt.listTitle         || 'All ' + s.entityNamePlural),
  };

  // Sample data
  s.sampleData = Array.isArray(s.sampleData) ? s.sampleData.slice(0, 5) : [];

  // User roles
  s.userRoles = Array.isArray(s.userRoles) && s.userRoles.length ? s.userRoles : ['admin', 'user'];

  return s;
}

// ─── CSS — domain-themed ──────────────────────────────────────────────────────

function generateCSS(spec) {
  const { primaryColor, secondaryColor, accentColor, statusColors, statusValues } = spec;

  // Generate status badge CSS from spec
  const statusBadgeCSS = statusValues.map(sv => {
    const color = statusColors[sv] || primaryColor;
    const id    = safeId(sv);
    // Lighten background (add alpha)
    return `.badge-${id} { background: ${color}18; color: ${color}; border: 1px solid ${color}40; }`;
  }).join('\n');

  return `/* Generated for: ${esc(spec.appName)} — ${esc(spec.businessName)} */
:root {
  --primary: ${primaryColor};
  --primary-dark: ${adjustBrightness(primaryColor, -20)};
  --primary-light: ${primaryColor}18;
  --secondary: ${secondaryColor};
  --accent: ${accentColor};
  --bg: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;
  --text: #0f172a;
  --text-muted: #64748b;
  --danger: #ef4444;
  --success: #10b981;
  --warning: #f59e0b;
  --radius: 12px;
  --shadow: 0 4px 20px -2px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 40px -8px rgba(0,0,0,0.12);
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); line-height: 1.6; min-height: 100vh; -webkit-font-smoothing: antialiased; }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Utilities */
.muted { color: var(--text-muted); }
.small { font-size: 0.8rem; }
.center { text-align: center; }
.flex { display: flex; }
.items-center { align-items: center; }
.gap-2 { gap: 0.5rem; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  border: none; border-radius: 8px; padding: 0.55rem 1.1rem;
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
  white-space: nowrap;
}
.btn:active { transform: scale(0.98); }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-dark); box-shadow: 0 4px 12px ${primaryColor}40; }
.btn-secondary { background: var(--accent); color: var(--primary); border: 1.5px solid ${primaryColor}30; }
.btn-secondary:hover { background: ${primaryColor}20; }
.btn-ghost { background: #fff; border: 1.5px solid var(--border); color: var(--text); }
.btn-ghost:hover { background: #f8fafc; }
.btn-danger { background: #fff; border: 1.5px solid #fecdd3; color: var(--danger); }
.btn-danger:hover { background: #fff1f2; }
.btn-block { width: 100%; }
.btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.btn-icon { padding: 0.5rem; border-radius: 8px; }

/* Form elements */
label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; font-weight: 500; color: var(--text); margin-bottom: 1rem; }
.label-row { flex-direction: row; align-items: center; gap: 0.5rem; margin-bottom: 0; }
input, select, textarea {
  font: inherit; font-size: 0.9rem; padding: 0.6rem 0.85rem;
  border: 1.5px solid var(--border); border-radius: 8px;
  background: #fff; color: var(--text); transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
}
input:focus, select:focus, textarea:focus {
  outline: none; border-color: var(--primary);
  box-shadow: 0 0 0 3px ${primaryColor}25;
}
textarea { resize: vertical; min-height: 80px; }
input[type="search"] { padding-left: 2.2rem; }
.input-group { position: relative; }
.input-group svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }

.field-icon { font-size: 1rem; flex-shrink: 0; }
.error-msg { color: var(--danger); background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem; margin-bottom: 0.75rem; }

/* Auth pages */
.auth-wrap { display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 1.5rem; background: linear-gradient(135deg, var(--accent) 0%, #fff 60%); }
.auth-card { width: 100%; max-width: 420px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 20px; padding: 2rem; box-shadow: var(--shadow-lg); }
.auth-logo { text-align: center; margin-bottom: 1.75rem; }
.auth-logo .logo-icon { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 0.75rem; }
.auth-logo h1 { font-size: 1.4rem; font-weight: 800; color: var(--text); margin-bottom: 0.25rem; }
.auth-logo p { color: var(--text-muted); font-size: 0.9rem; }
.auth-footer { margin-top: 1.25rem; text-align: center; font-size: 0.875rem; color: var(--text-muted); }

/* App shell */
.app-shell { display: flex; min-height: 100vh; }

/* Sidebar */
.sidebar {
  width: 240px; flex-shrink: 0;
  background: linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%);
  color: #e2e8f0; display: flex; flex-direction: column;
}
.sidebar-brand {
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; gap: 0.75rem;
}
.sidebar-brand .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
.sidebar-brand .brand-name { font-weight: 700; font-size: 0.95rem; line-height: 1.3; }
.sidebar-brand .brand-biz { font-size: 0.72rem; color: rgba(255,255,255,0.45); margin-top: 0.1rem; }
.sidebar-nav { flex: 1; padding: 0.75rem 0.75rem; }
.nav-section { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.3); padding: 0.75rem 0.75rem 0.35rem; }
.nav-link {
  display: flex; align-items: center; gap: 0.65rem;
  padding: 0.6rem 0.75rem; border-radius: 8px;
  color: rgba(255,255,255,0.6); font-size: 0.875rem;
  text-decoration: none; margin-bottom: 0.15rem;
  transition: background 0.15s, color 0.15s;
}
.nav-link:hover { background: rgba(255,255,255,0.07); color: #fff; text-decoration: none; }
.nav-link.active { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #fff; font-weight: 600; }
.nav-link .nav-icon { font-size: 1rem; flex-shrink: 0; }
.sidebar-footer { padding: 0.75rem; border-top: 1px solid rgba(255,255,255,0.07); }
.user-chip { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.06); }
.user-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; flex-shrink: 0; }
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 0.8rem; font-weight: 600; color: #fff; truncate: true; }
.user-role { font-size: 0.68rem; color: rgba(255,255,255,0.4); }
.logout-btn { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 0.8rem; padding: 0.25rem; border-radius: 6px; transition: color 0.15s; }
.logout-btn:hover { color: #ef4444; }

/* Main content area */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow-x: hidden; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.5rem; background: var(--surface); border-bottom: 1.5px solid var(--border); gap: 1rem; flex-wrap: wrap; }
.topbar-left { display: flex; align-items: center; gap: 0.75rem; }
.topbar h1 { font-size: 1.15rem; font-weight: 700; color: var(--text); }
.breadcrumb { font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; }
.page-content { flex: 1; padding: 1.5rem; overflow-y: auto; }

/* Stats grid */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 1.1rem 1.25rem; display: flex; align-items: center; gap: 0.9rem; box-shadow: var(--shadow); transition: box-shadow 0.15s; }
.stat-card:hover { box-shadow: var(--shadow-lg); }
.stat-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
.stat-body .stat-value { font-size: 1.6rem; font-weight: 800; line-height: 1; color: var(--text); }
.stat-body .stat-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem; font-weight: 500; }

/* Panel */
.panel { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1.5px solid var(--border); gap: 0.75rem; flex-wrap: wrap; }
.panel-title { font-size: 0.9rem; font-weight: 600; }
.panel-body { padding: 0; }
.toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.search-box { position: relative; }
.search-box input { padding-left: 2rem; width: 220px; }
.search-box .search-icon { position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem; pointer-events: none; }
.filter-select { width: auto; min-width: 130px; }

/* Table */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
thead { background: #f8fafc; }
th { text-align: left; padding: 0.75rem 1rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1.5px solid var(--border); white-space: nowrap; }
td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: #f8fafc; }
.cell-primary { font-weight: 600; color: var(--text); }
.cell-secondary { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem; }
.cell-actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
.empty-row td { text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.9rem; }
.empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }

/* Status badges — base */
.badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize; }
${statusBadgeCSS}

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100; }
.modal-overlay[hidden] { display: none !important; }
.modal-box { background: var(--surface); border-radius: 18px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.2); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1.5px solid var(--border); }
.modal-header h3 { font-size: 1rem; font-weight: 700; }
.modal-close { background: none; border: none; font-size: 1.2rem; color: var(--text-muted); cursor: pointer; padding: 0.25rem; border-radius: 6px; }
.modal-close:hover { background: #f1f5f9; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1.5px solid var(--border); display: flex; justify-content: flex-end; gap: 0.75rem; }

/* Notifications / toast */
.toast { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 200; background: #0f172a; color: #fff; padding: 0.75rem 1.25rem; border-radius: 10px; font-size: 0.875rem; font-weight: 500; box-shadow: var(--shadow-lg); animation: slideUp 0.25s ease; }
@keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* Hamburger for mobile */
.hamburger { display: none; background: none; border: 1.5px solid var(--border); border-radius: 8px; padding: 0.4rem 0.6rem; cursor: pointer; color: var(--text-muted); }

/* Reports page */
.report-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; }
.report-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
.report-card h3 { font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; }
.progress-bar { height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; margin: 0.35rem 0; }
.progress-fill { height: 100%; border-radius: 999px; background: var(--primary); transition: width 0.4s ease; }
.report-row { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; font-size: 0.85rem; border-bottom: 1px solid var(--border); }
.report-row:last-child { border-bottom: none; }

@media (max-width: 768px) {
  .sidebar { position: fixed; inset-y: 0; left: 0; z-index: 50; transform: translateX(-100%); transition: transform 0.25s ease; }
  .sidebar.open { transform: translateX(0); }
  .mob-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 40; }
  .mob-overlay.show { display: block; }
  .hamburger { display: flex; align-items: center; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .search-box input { width: 160px; }
  .page-content { padding: 1rem; }
  .panel-header { flex-direction: column; align-items: flex-start; }
}
`.trim();
}

// Darken/lighten a hex color by a delta (-255 to 255 per channel)
function adjustBrightness(hex, delta) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + delta));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (n & 0xff) + delta));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ─── Login page ───────────────────────────────────────────────────────────────

function generateLoginPage(spec) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in — ${esc(spec.appName)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="auth-wrap">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="logo-icon">${esc(spec.entityIcon)}</div>
      <h1>${esc(spec.appName)}</h1>
      <p>${esc(spec.businessName) || 'Welcome back'}</p>
    </div>
    <form id="login-form">
      <label>Email address
        <input type="email" id="email" required autocomplete="username" placeholder="you@company.com" value="admin@example.com" />
      </label>
      <label>Password
        <input type="password" id="password" required autocomplete="current-password" placeholder="••••••••" value="admin123" />
      </label>
      <p id="err" class="error-msg" hidden></p>
      <button type="submit" class="btn btn-primary btn-block" id="btn-login">Sign in</button>
    </form>
    <div class="auth-footer">
      <span style="opacity:.6;font-size:.78rem">Demo: admin@example.com / admin123</span><br/>
      <a href="/register.html" style="margin-top:.5rem;display:inline-block">Create an account →</a>
    </div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('btn-login');
      const err = document.getElementById('err');
      err.hidden = true; btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ email: document.getElementById('email').value.trim(), password: document.getElementById('password').value }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { err.textContent = d.error || 'Login failed'; err.hidden = false; }
        else window.location.href = '/';
      } catch(_) { err.textContent = 'Server not reachable'; err.hidden = false; }
      finally { btn.disabled = false; btn.textContent = 'Sign in'; }
    });
  </script>
</body>
</html>`;
}

// ─── Register page ────────────────────────────────────────────────────────────

function generateRegisterPage(spec) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Register — ${esc(spec.appName)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="auth-wrap">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="logo-icon">${esc(spec.entityIcon)}</div>
      <h1>${esc(spec.appName)}</h1>
      <p>Create your account</p>
    </div>
    <form id="reg-form">
      <label>Full name <input type="text" id="name" required placeholder="Your name" /></label>
      <label>Email address <input type="email" id="email" required autocomplete="username" placeholder="you@company.com" /></label>
      <label>Password (min 6 chars) <input type="password" id="password" required autocomplete="new-password" placeholder="••••••••" /></label>
      <p id="err" class="error-msg" hidden></p>
      <button type="submit" class="btn btn-primary btn-block" id="btn-reg">Create account</button>
    </form>
    <div class="auth-footer"><a href="/login.html">← Back to sign in</a></div>
  </div>
  <script>
    document.getElementById('reg-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('btn-reg');
      const err = document.getElementById('err');
      err.hidden = true; btn.disabled = true; btn.textContent = 'Creating…';
      try {
        const res = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name: document.getElementById('name').value.trim(), email: document.getElementById('email').value.trim(), password: document.getElementById('password').value }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { err.textContent = d.error || 'Registration failed'; err.hidden = false; }
        else window.location.href = '/';
      } catch(_) { err.textContent = 'Server not reachable'; err.hidden = false; }
      finally { btn.disabled = false; btn.textContent = 'Create account'; }
    });
  </script>
</body>
</html>`;
}

// ─── Sidebar partial ──────────────────────────────────────────────────────────

function generateSidebar(spec, activePage) {
  const navLinks = spec.navPages.map(p => {
    const isActive = p.id === activePage || (activePage === 'dashboard' && (p.href === '/' || p.id === 'dashboard'));
    return `<a href="${esc(p.href)}" class="nav-link${isActive ? ' active' : ''}">
      <span class="nav-icon">${esc(p.icon || '📄')}</span>
      ${esc(p.label)}
    </a>`;
  }).join('\n      ');

  return `<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon">${esc(spec.entityIcon)}</div>
      <div>
        <div class="brand-name">${esc(spec.appName)}</div>
        <div class="brand-biz">${esc(spec.businessName)}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">Main</div>
      ${navLinks}
    </nav>
    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="user-avatar" id="user-avatar">?</div>
        <div class="user-info">
          <div class="user-name" id="user-name">Loading…</div>
          <div class="user-role" id="user-role"></div>
        </div>
        <button class="logout-btn" id="logout-btn" title="Sign out">⎋</button>
      </div>
    </div>
  </aside>
  <div class="mob-overlay" id="mob-overlay"></div>`;
}

// ─── Common JS partial ────────────────────────────────────────────────────────

function commonJS() {
  return `
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(method,url,body){
  const o={method,headers:{'Content-Type':'application/json'},credentials:'same-origin'};
  if(body)o.body=JSON.stringify(body);
  const r=await fetch(url,o);
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||r.statusText||'Request failed');
  return d;
}
function toast(msg,type='success'){
  const t=document.createElement('div');
  t.className='toast';
  t.style.background=type==='error'?'#ef4444':type==='warning'?'#f59e0b':'#0f172a';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}
async function loadUser(){
  try{
    const me=await api('GET','/api/auth/me');
    const av=document.getElementById('user-avatar');
    const nm=document.getElementById('user-name');
    const rl=document.getElementById('user-role');
    if(av)av.textContent=(me.name||'?').charAt(0).toUpperCase();
    if(nm)nm.textContent=me.name||me.email;
    if(rl)rl.textContent=me.role||'user';
    return me;
  }catch(e){window.location.href='/login.html';return null;}
}
document.getElementById('logout-btn')?.addEventListener('click',async()=>{
  await api('POST','/api/auth/logout').catch(()=>{});
  window.location.href='/login.html';
});
// Mobile sidebar
const sidebar=document.getElementById('sidebar');
const overlay=document.getElementById('mob-overlay');
const ham=document.getElementById('hamburger');
if(ham)ham.addEventListener('click',()=>{sidebar?.classList.toggle('open');overlay?.classList.toggle('show');});
if(overlay)overlay.addEventListener('click',()=>{sidebar?.classList.remove('open');overlay.classList.remove('show');});`;
}

// ─── Main dashboard / entity list page ───────────────────────────────────────

function generateIndexPage(spec) {
  const dt = spec.domainTerminology;

  // Table header cols — title + first 3 fields + status + date
  const thCols = spec.entityFields.slice(0, 3).map(f =>
    `<th>${esc(f.label)}</th>`).join('');
  const tdCols = spec.entityFields.slice(0, 3).map(f =>
    `<td>\${esc(String(r.${safeId(f.name)}??'—'))}</td>`).join('');

  // Modal form fields
  const modalFields = spec.entityFields.map(f => {
    const id  = `f_${safeId(f.name)}`;
    const lbl = `${esc(f.icon || '')} ${esc(f.label)}`;
    if (f.type === 'textarea') {
      return `<label>${lbl}<textarea id="${id}" ${f.required ? 'required' : ''} rows="3"></textarea></label>`;
    }
    if (f.type === 'select') {
      return `<label>${lbl}<select id="${id}">${spec.statusValues.map(sv => `<option value="${esc(sv)}">${esc(cap(sv))}</option>`).join('')}</select></label>`;
    }
    const inputType = f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
    return `<label>${lbl}<input type="${inputType}" id="${id}" ${f.required ? 'required' : ''} /></label>`;
  }).join('\n      ');

  // Status options for filter + modal
  const statusOpts = spec.statusValues.map(sv =>
    `<option value="${esc(sv)}">${esc(cap(sv))}</option>`).join('');

  // Stats cards
  const statsCards = spec.dashboardStats.map(stat =>
    `<div class="stat-card" style="border-top:3px solid ${esc(stat.color)}">
      <div class="stat-icon" style="background:${esc(stat.color)}18">${esc(stat.icon)}</div>
      <div class="stat-body">
        <div class="stat-value" id="stat-${esc(safeId(stat.key))}">0</div>
        <div class="stat-label">${esc(stat.label)}</div>
      </div>
    </div>`).join('\n    ');

  // JS: collect body from modal fields
  const fieldBody = ['title', ...spec.entityFields.map(f => f.name)].map(name => {
    const id = name === 'title' ? 'f_title' : `f_${safeId(name)}`;
    return `${safeId(name)}: document.getElementById('${id}')?.value ?? ''`;
  }).join(', ');

  // JS: populate modal fields on edit
  const fieldPopulate = spec.entityFields.map(f => {
    const id = `f_${safeId(f.name)}`;
    return `const el_${safeId(f.name)}=document.getElementById('${id}'); if(el_${safeId(f.name)})el_${safeId(f.name)}.value=r.${safeId(f.name)}??'';`;
  }).join(' ');

  // JS: stats computation
  const statsJS = spec.dashboardStats.map(stat => {
    if (stat.filter) {
      return `document.getElementById('stat-${safeId(stat.key)}').textContent = records.filter(r=>r.status==='${safeId(stat.filter)}').length;`;
    }
    return `document.getElementById('stat-${safeId(stat.key)}').textContent = records.length;`;
  }).join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(dt.listTitle)} — ${esc(spec.appName)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
<div class="app-shell">
  ${generateSidebar(spec, 'dashboard')}
  <div class="main">
    <header class="topbar">
      <div class="topbar-left">
        <button class="hamburger" id="hamburger">☰</button>
        <div>
          <h1>${esc(spec.entityIcon)} ${esc(dt.listTitle)}</h1>
          <div class="breadcrumb muted">${esc(spec.appName)} › ${esc(spec.entityNamePlural)}</div>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-new">+ ${esc(dt.createBtn)}</button>
    </header>
    <div class="page-content">
      <div class="stats-grid">${statsCards}</div>
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">${esc(dt.listTitle)}</span>
          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="search" id="search" placeholder="${esc(dt.searchPlaceholder)}" />
            </div>
            <select class="filter-select" id="status-filter">
              <option value="">All statuses</option>
              ${statusOpts}
            </select>
          </div>
        </div>
        <div class="panel-body table-wrap">
          <table>
            <thead>
              <tr>
                <th>${esc(spec.entityName)}</th>
                ${thCols}
                <th>Status</th>
                <th>Updated</th>
                <th style="width:120px"></th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Create / Edit modal -->
<div class="modal-overlay" id="modal" hidden>
  <div class="modal-box">
    <div class="modal-header">
      <h3 id="modal-title">New ${esc(spec.entityName)}</h3>
      <button class="modal-close" id="btn-modal-close">✕</button>
    </div>
    <div class="modal-body">
      <p id="modal-err" class="error-msg" hidden></p>
      <form id="entity-form">
        <input type="hidden" id="record-id" />
        <label>Name / Title <input type="text" id="f_title" required placeholder="Enter ${esc(spec.entityName.toLowerCase())} name" /></label>
        ${modalFields}
        <label>Status
          <select id="f_status">
            ${statusOpts}
          </select>
        </label>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="btn-cancel">Cancel</button>
      <button class="btn btn-primary" id="btn-save">Save ${esc(spec.entityName)}</button>
    </div>
  </div>
</div>

<script>
${commonJS()}

let records = [];

function badgeFor(status) {
  const id = status ? status.replace(/[^a-zA-Z0-9_-]/g,'_') : 'unknown';
  return '<span class="badge badge-' + id + '">' + esc(status ? status.replace(/_/g,' ') : '') + '</span>';
}

function renderStats() { ${statsJS} }

function renderRows() {
  const q   = (document.getElementById('search').value || '').toLowerCase();
  const st  = document.getElementById('status-filter').value;
  let rows  = records.slice();
  if (q)  rows = rows.filter(r => (r.title||'').toLowerCase().includes(q) || Object.values(r).some(v=>String(v).toLowerCase().includes(q)));
  if (st) rows = rows.filter(r => r.status === st);
  const tbody = document.getElementById('rows');
  tbody.innerHTML = rows.map(r => \`<tr>
    <td>
      <div class="cell-primary">\${esc(r.title||'—')}</div>
      <div class="cell-secondary muted">#\${r.id}</div>
    </td>
    ${tdCols}
    <td>\${badgeFor(r.status)}</td>
    <td class="muted small">\${esc((r.updated_at||r.created_at||'').slice(0,10))}</td>
    <td class="cell-actions">
      <button class="btn btn-ghost btn-icon" data-edit="\${r.id}" title="Edit">✏️</button>
      <button class="btn btn-danger btn-icon" data-del="\${r.id}" title="Delete">🗑</button>
    </td>
  </tr>\`).join('') || '<tr class="empty-row"><td colspan="99"><span class="empty-icon">${esc(spec.entityIcon)}</span>${esc(dt.emptyState)}</td></tr>';
  renderStats();
}

async function load() {
  await loadUser();
  records = await api('GET', '/api/records').catch(() => []);
  renderRows();
}

document.getElementById('search').addEventListener('input', renderRows);
document.getElementById('status-filter').addEventListener('change', renderRows);

function openModal(title, rec) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('record-id').value = rec?.id || '';
  document.getElementById('f_title').value = rec?.title || '';
  document.getElementById('f_status').value = rec?.status || '${esc(spec.statusValues[0] || 'new')}';
  ${fieldPopulate}
  document.getElementById('modal-err').hidden = true;
  document.getElementById('modal').hidden = false;
}
function closeModal() { document.getElementById('modal').hidden = true; }
document.getElementById('btn-new').addEventListener('click', () => openModal('New ${esc(spec.entityName)}', null));
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', e => { if(e.target === document.getElementById('modal')) closeModal(); });

document.getElementById('btn-save').addEventListener('click', async () => {
  const id   = document.getElementById('record-id').value;
  const body = { ${fieldBody}, status: document.getElementById('f_status').value };
  const errEl = document.getElementById('modal-err');
  errEl.hidden = true;
  try {
    if (id) await api('PUT', '/api/records/' + id, body);
    else    await api('POST', '/api/records', body);
    closeModal();
    toast(id ? '${esc(spec.entityName)} updated ✓' : '${esc(spec.entityName)} created ✓');
    await load();
  } catch(e) { errEl.textContent = e.message; errEl.hidden = false; }
});

document.getElementById('rows').addEventListener('click', async e => {
  const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
  const delId  = e.target.closest('[data-del]')?.getAttribute('data-del');
  if (editId) {
    const r = records.find(x => String(x.id) === editId);
    if (r) openModal('Edit ${esc(spec.entityName)}', r);
  }
  if (delId && confirm('${esc(dt.deleteConfirm)}')) {
    try { await api('DELETE', '/api/records/' + delId); toast('Deleted'); await load(); }
    catch(e) { toast(e.message, 'error'); }
  }
});

load();
</script>
</body>
</html>`;
}

// ─── Reports page ─────────────────────────────────────────────────────────────

function generateReportsPage(spec) {
  const dt = spec.domainTerminology;
  const statusBreakdownRows = spec.statusValues.map(sv =>
    `<div class="report-row">
      <span>\${esc('${esc(cap(sv))}')} \${badgeFor('${esc(sv)}')}</span>
      <span id="rep-${safeId(sv)}" style="font-weight:700">0</span>
    </div>`).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reports — ${esc(spec.appName)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
<div class="app-shell">
  ${generateSidebar(spec, 'reports')}
  <div class="main">
    <header class="topbar">
      <div class="topbar-left">
        <button class="hamburger" id="hamburger">☰</button>
        <div>
          <h1>📊 Reports &amp; Analytics</h1>
          <div class="breadcrumb muted">${esc(spec.appName)} › Reports</div>
        </div>
      </div>
    </header>
    <div class="page-content">
      <div class="stats-grid" id="rep-stats"></div>
      <div class="report-grid" style="margin-top:1.5rem">
        <div class="report-card">
          <h3>${esc(spec.entityName)} Status Breakdown</h3>
          <div id="status-breakdown">
            ${spec.statusValues.map(sv => `
            <div class="report-row" style="margin-bottom:.25rem">
              <span style="display:flex;align-items:center;gap:.5rem">
                <span class="badge badge-${safeId(sv)}">${esc(cap(sv))}</span>
              </span>
              <span style="display:flex;align-items:center;gap:.75rem">
                <div class="progress-bar" style="width:100px">
                  <div class="progress-fill" id="prog-${safeId(sv)}" style="width:0%;background:${esc(spec.statusColors[sv] || spec.primaryColor)}"></div>
                </div>
                <strong id="rep-${safeId(sv)}">0</strong>
              </span>
            </div>`).join('')}
          </div>
        </div>
        <div class="report-card">
          <h3>Recent Activity</h3>
          <div id="recent-list"><p class="muted small">Loading…</p></div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
${commonJS()}

function badgeFor(status) {
  const id = status ? status.replace(/[^a-zA-Z0-9_-]/g,'_') : 'unknown';
  return '<span class="badge badge-' + id + '">' + esc(status ? status.replace(/_/g,' ') : '') + '</span>';
}

async function load() {
  await loadUser();
  const records = await api('GET', '/api/records').catch(() => []);

  // Stats grid
  const statsEl = document.getElementById('rep-stats');
  ${spec.dashboardStats.map(stat => {
    const count = stat.filter
      ? `records.filter(r=>r.status==='${safeId(stat.filter)}').length`
      : `records.length`;
    return `statsEl.innerHTML += '<div class="stat-card" style="border-top:3px solid ${esc(stat.color)}"><div class="stat-icon" style="background:${esc(stat.color)}18">${esc(stat.icon)}</div><div class="stat-body"><div class="stat-value">' + ${count} + '</div><div class="stat-label">${esc(stat.label)}</div></div></div>';`;
  }).join('\n  ')}

  // Status breakdown
  const total = records.length || 1;
  ${spec.statusValues.map(sv => `
  const cnt_${safeId(sv)} = records.filter(r=>r.status==='${safeId(sv)}').length;
  const el_${safeId(sv)} = document.getElementById('rep-${safeId(sv)}');
  const prog_${safeId(sv)} = document.getElementById('prog-${safeId(sv)}');
  if(el_${safeId(sv)}) el_${safeId(sv)}.textContent = cnt_${safeId(sv)};
  if(prog_${safeId(sv)}) prog_${safeId(sv)}.style.width = Math.round(cnt_${safeId(sv)}/total*100) + '%';`).join('')}

  // Recent records
  const recentEl = document.getElementById('recent-list');
  const recent = records.slice(0,8);
  recentEl.innerHTML = recent.length
    ? recent.map(r => '<div class="report-row"><span>' + esc(r.title||'—') + '</span><span>' + badgeFor(r.status) + '</span></div>').join('')
    : '<p class="muted small">No ${esc(spec.entityNamePlural.toLowerCase())} yet.</p>';
}
load();
</script>
</body>
</html>`;
}

// ─── Seed data helper ─────────────────────────────────────────────────────────

function seedSampleData(spec, dbPath) {
  if (!spec.sampleData || !spec.sampleData.length) return;
  let store;
  try { store = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (_) { return; }

  // Only seed if no records exist
  if (store.records && store.records.length > 0) return;

  const adminUser = store.users && store.users.find(u => u.role === 'admin');
  if (!adminUser) return;

  const now = new Date().toISOString();
  store.records = store.records || [];
  store.seq = store.seq || { users: 10, records: 1 };

  spec.sampleData.forEach(d => {
    const record = {
      id:         store.seq.records++,
      title:      String(d.title || d.name || 'Sample'),
      status:     String(d.status || spec.statusValues[0] || 'new'),
      owner_id:   adminUser.id,
      created_at: now,
      updated_at: now,
    };
    // Copy all extra fields from sample data
    spec.entityFields.forEach(f => {
      if (d[f.name] !== undefined) record[f.name] = String(d[f.name]);
    });
    store.records.push(record);
  });

  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2));
}

// ─── Main generateApp ─────────────────────────────────────────────────────────

function generateApp(rawSpec, projectId) {
  const spec    = normalise(rawSpec);
  const touched = [];

  // 1. config.json
  const oldCfg    = readJson('config.json', { version: '1.0.0' });
  const newVersion = bumpVersion(oldCfg.version || '1.0.0');
  writeJson('config.json', {
    appName:          spec.appName,
    businessName:     spec.businessName,
    entityName:       spec.entityName,
    entityNamePlural: spec.entityNamePlural,
    primaryColor:     spec.primaryColor,
    projectId:        projectId || null,
    port:             oldCfg.port || 3847,
    version:          newVersion,
    generatedAt:      new Date().toISOString(),
  });
  touched.push('config.json');

  // 2. CSS (domain-themed)
  write('public/styles.css', generateCSS(spec));
  touched.push('public/styles.css');

  // 3. Auth pages
  write('public/login.html',    generateLoginPage(spec));
  write('public/register.html', generateRegisterPage(spec));
  touched.push('public/login.html', 'public/register.html');

  // 4. Main entity page
  write('public/index.html', generateIndexPage(spec));
  touched.push('public/index.html');

  // 5. Reports page (always generated — every business needs analytics)
  write('public/reports.html', generateReportsPage(spec));
  touched.push('public/reports.html');

  // 6. Modules
  const enabledMods = [];
  if (spec.modules.includes('attendance')) {
    enabledMods.push('attendance');
    touched.push('modules/enabled.json');
  }
  writeJson('modules/enabled.json', enabledMods);
  touched.push('modules/enabled.json');

  // 7. Seed sample data
  const dbPath = require('path').join(ROOT, 'data', 'store.json');
  seedSampleData(spec, dbPath);
  touched.push('data/store.json (seeded)');

  // 8. Changelog
  let log = readJson('data/changelog.json', []);
  log = Array.isArray(log) ? log : [];
  log.unshift({
    version: newVersion, projectId: projectId || null, action: 'generate',
    spec: { appName: spec.appName, entityName: spec.entityName, primaryColor: spec.primaryColor, statusValues: spec.statusValues, modules: spec.modules },
    filesTouched: touched, at: new Date().toISOString(),
  });
  writeJson('data/changelog.json', log);
  touched.push('data/changelog.json');

  return { version: newVersion, files: touched, at: new Date().toISOString() };
}

// ─── applyModification (incremental) ─────────────────────────────────────────

function applyModification(plan, currentRawSpec, projectId) {
  const spec    = normalise(currentRawSpec || {});
  const touched = [];
  const cfg     = readJson('config.json', { version: '1.0.0' });
  const newVer  = bumpVersion(cfg.version || '1.0.0');

  // Add new modules
  if (Array.isArray(plan.newModules)) {
    plan.newModules.forEach(m => { if (!spec.modules.includes(m)) spec.modules.push(m); });
  }

  if (spec.modules.includes('attendance')) {
    // attendance module already has its own handler in modules/attendance.js
    const enabledMods = readJson('modules/enabled.json', []);
    if (!enabledMods.includes('attendance')) {
      enabledMods.push('attendance');
      writeJson('modules/enabled.json', enabledMods);
      touched.push('modules/enabled.json');
    }
  }

  // Rebuild nav with new pages
  if (Array.isArray(plan.newModules) && plan.newModules.length) {
    spec.navPages = spec.navPages || [];
    plan.newModules.forEach(m => {
      if (!spec.navPages.find(p => p.id === m)) {
        spec.navPages.push({ id: m, label: cap(m), icon: '📋', href: `/${m}.html` });
      }
    });
    // Regenerate index page with updated nav
    write('public/index.html', generateIndexPage(spec));
    touched.push('public/index.html');
  }

  // Apply new entity fields if any
  if (Array.isArray(plan.newEntityFields)) {
    plan.newEntityFields.forEach(nf => {
      if (!spec.entityFields.find(f => f.name === nf.field)) {
        spec.entityFields.push({ name: nf.field, label: cap(nf.field), type: nf.type || 'text', required: false, icon: '' });
      }
    });
    write('public/index.html', generateIndexPage(spec));
    if (!touched.includes('public/index.html')) touched.push('public/index.html');
  }

  cfg.version = newVer;
  cfg.lastChange = { summary: plan.summary, at: new Date().toISOString() };
  writeJson('config.json', cfg);
  touched.push('config.json');

  let log = readJson('data/changelog.json', []);
  log = Array.isArray(log) ? log : [];
  log.unshift({ version: newVer, projectId: projectId || null, action: 'modify', plan: { summary: plan.summary, newModules: plan.newModules, steps: plan.steps }, filesTouched: touched, at: new Date().toISOString() });
  writeJson('data/changelog.json', log);
  touched.push('data/changelog.json');

  return { version: newVer, files: touched, at: new Date().toISOString() };
}

module.exports = { generateApp, applyModification };
