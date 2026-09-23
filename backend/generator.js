/**
 * Generator Engine
 * Takes an app-generation spec (from AI) and writes/updates actual files on disk.
 * Does NOT regenerate from scratch each time — patches incrementally.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function writeFile(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function readJsonFile(rel, fallback) {
  const full = path.join(ROOT, rel);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(rel, data) {
  writeFile(rel, JSON.stringify(data, null, 2));
}

// ─── Booleans ─────────────────────────────────────────────────────────────────

function bumpVersion(v) {
  const s = String(v || '1.0.0').replace(/^v/i, '');
  const parts = s.split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

function generateCSS() {
  return `
:root {
  --bg: #f8fafc;
  --card: #ffffff;
  --border: #e2e8f0;
  --text: #0f172a;
  --muted: #64748b;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --danger: #e11d48;
  --success: #059669;
  --radius: 12px;
  --shadow: 0 4px 20px -2px rgba(0,0,0,0.06);
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.muted { color: var(--muted); }
.small { font-size: 0.85rem; }
.center { text-align: center; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  border: none; border-radius: 8px; padding: 0.55rem 1rem;
  font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-hover); }
.btn-ghost { background: #fff; border: 1px solid var(--border); color: var(--text); }
.btn-ghost:hover { background: #f1f5f9; }
.btn-danger { background: #fff; border: 1px solid #fecdd3; color: var(--danger); }
.btn-danger:hover { background: #fff1f2; }
.btn-block { width: 100%; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.85rem; }
input, select, textarea { font: inherit; padding: 0.55rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: #fff; color: var(--text); }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
.error { color: var(--danger); background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; margin-bottom: 0.75rem; }
.auth-page { display: flex; align-items: center; justify-content: center; padding: 1.5rem; min-height: 100vh; background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.12), transparent), var(--bg); }
.auth-card { width: 100%; max-width: 400px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 1.75rem; box-shadow: var(--shadow); }
.auth-brand { text-align: center; margin-bottom: 1.25rem; }
.auth-brand h1 { margin: 0.5rem 0 0; font-size: 1.35rem; }
.auth-brand p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.9rem; }
.app-shell { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: #0f172a; color: #e2e8f0; padding: 1.25rem 0; flex-shrink: 0; }
.sidebar .brand { padding: 0 1.25rem 1.25rem; font-weight: 700; font-size: 1rem; border-bottom: 1px solid #1e293b; margin-bottom: 0.75rem; }
.sidebar a { display: block; padding: 0.55rem 1.25rem; color: #94a3b8; font-size: 0.9rem; }
.sidebar a:hover, .sidebar a.active { color: #fff; background: #1e293b; text-decoration: none; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 1.5rem; background: var(--card); border-bottom: 1px solid var(--border); }
.topbar h2 { margin: 0; font-size: 1.1rem; }
.content { padding: 1.25rem 1.5rem 2rem; }
.panel { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.panel-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 1rem 1.15rem; border-bottom: 1px solid var(--border); }
.panel-body { padding: 1rem 1.15rem; }
.toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.toolbar input, .toolbar select { min-width: 140px; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { text-align: left; padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
tr:last-child td { border-bottom: none; }
.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.badge-open { background: #eff6ff; color: #1d4ed8; }
.badge-in_progress { background: #fffbeb; color: #b45309; }
.badge-done { background: #ecfdf5; color: #047857; }
.badge-archived { background: #f1f5f9; color: #475569; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.modal-backdrop[hidden] { display: none !important; }
.modal { background: var(--card); border-radius: 16px; width: 100%; max-width: 520px; padding: 1.25rem; box-shadow: 0 20px 40px rgba(0,0,0,0.15); max-height: 90vh; overflow-y: auto; }
.modal h3 { margin: 0 0 1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.stat { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.9rem 1rem; }
.stat .label { font-size: 0.75rem; color: var(--muted); font-weight: 500; }
.stat .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.15rem; }
@media (max-width: 768px) { .app-shell { flex-direction: column; } .sidebar { width: 100%; } .content { padding: 1rem; } }
`.trim();
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
<body class="auth-page">
  <div class="auth-card">
    <div class="auth-brand">
      <h1>${esc(spec.appName)}</h1>
      <p class="muted">${esc(spec.businessName)}</p>
    </div>
    <form id="login-form">
      <label>Email<input type="email" id="email" required autocomplete="username" value="admin@example.com" /></label>
      <label>Password<input type="password" id="password" required autocomplete="current-password" value="admin123" /></label>
      <p id="error" class="error" hidden></p>
      <button type="submit" class="btn btn-primary btn-block">Sign in</button>
    </form>
    <p class="muted small center" style="margin-top:.75rem">Demo: admin@example.com / admin123</p>
    <p class="muted small center"><a href="/register.html">Create an account</a></p>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('error');
      err.hidden = true;
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: document.getElementById('email').value.trim(), password: document.getElementById('password').value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { err.textContent = data.error || 'Login failed'; err.hidden = false; return; }
      window.location.href = '/';
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
<body class="auth-page">
  <div class="auth-card">
    <div class="auth-brand">
      <h1>${esc(spec.appName)}</h1>
      <p class="muted">Create your account</p>
    </div>
    <form id="reg-form">
      <label>Name<input type="text" id="name" required /></label>
      <label>Email<input type="email" id="email" required autocomplete="username" /></label>
      <label>Password<input type="password" id="password" required autocomplete="new-password" /></label>
      <p id="error" class="error" hidden></p>
      <button type="submit" class="btn btn-primary btn-block">Create account</button>
    </form>
    <p class="muted small center" style="margin-top:.75rem"><a href="/login.html">Already have an account? Sign in</a></p>
  </div>
  <script>
    document.getElementById('reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('error');
      err.hidden = true;
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name: document.getElementById('name').value.trim(), email: document.getElementById('email').value.trim(), password: document.getElementById('password').value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { err.textContent = data.error || 'Registration failed'; err.hidden = false; return; }
      window.location.href = '/';
    });
  </script>
</body>
</html>`;
}

// ─── Main index page ──────────────────────────────────────────────────────────

function generateIndexPage(spec) {
  const fieldsHeaderCells = spec.entityFields
    .slice(0, 4)
    .map((f) => `<th>${esc(cap(f.name))}</th>`)
    .join('');
  const fieldsDataCells = spec.entityFields
    .slice(0, 4)
    .map((f) => `<td>\${esc(String(r.${esc(f.name)} ?? '—'))}</td>`)
    .join('');

  const modalFields = spec.entityFields
    .map((f) => {
      if (f.type === 'date') {
        return `<label>${esc(cap(f.name))}
          <input type="date" id="field-${esc(f.name)}" name="${esc(f.name)}" ${f.required ? 'required' : ''} />
        </label>`;
      }
      if (f.type === 'select' || f.type === 'status') {
        return `<label>${esc(cap(f.name))}
          <select id="field-${esc(f.name)}" name="${esc(f.name)}">
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
          </select>
        </label>`;
      }
      if (f.type === 'textarea' || f.type === 'text' || f.name === 'description' || f.name === 'notes') {
        return `<label>${esc(cap(f.name))}
          <textarea id="field-${esc(f.name)}" name="${esc(f.name)}" rows="3" ${f.required ? 'required' : ''}></textarea>
        </label>`;
      }
      return `<label>${esc(cap(f.name))}
        <input type="text" id="field-${esc(f.name)}" name="${esc(f.name)}" ${f.required ? 'required' : ''} />
      </label>`;
    })
    .join('\n');

  const fieldPopulate = spec.entityFields
    .map((f) => `document.getElementById('field-${f.name}').value = r.${f.name} || '';`)
    .join(' ');

  const fieldBody = spec.entityFields
    .map((f) => `${f.name}: document.getElementById('field-${f.name}').value,`)
    .join(' ');

  const hasAttendance = spec.modules.includes('attendance');
  const extraLinks = hasAttendance ? `<a href="/attendance.html">Attendance</a>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(spec.entityNamePlural)} — ${esc(spec.appName)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand">${esc(spec.appName)}</div>
    <a href="/" class="active">${esc(spec.entityNamePlural)}</a>
    ${extraLinks}
    <a href="#" id="logout-link">Logout</a>
  </aside>
  <div class="main">
    <header class="topbar">
      <h2>${esc(spec.entityNamePlural)}</h2>
      <div class="toolbar">
        <span class="muted small" id="user-label"></span>
        <button class="btn btn-primary" id="btn-new">New ${esc(spec.entityName)}</button>
      </div>
    </header>
    <div class="content">
      <div class="stats" id="stats"></div>
      <div class="panel">
        <div class="panel-header">
          <strong>All ${esc(spec.entityNamePlural.toLowerCase())}</strong>
          <div class="toolbar">
            <input type="search" id="filter" placeholder="Search…" />
            <select id="status-filter">
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div class="panel-body">
          <table>
            <thead><tr><th>Title</th>${fieldsHeaderCells}<th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="modal-backdrop" id="modal" hidden>
  <div class="modal">
    <h3 id="modal-title">New ${esc(spec.entityName)}</h3>
    <div id="modal-error" class="error" hidden></div>
    <form id="form">
      <input type="hidden" id="record-id" />
      <label>Title<input type="text" id="field-title" required /></label>
      ${modalFields}
      <label>Status
        <select id="field-status">
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
</div>
<script>
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function api(method,path,body){ const o={method,headers:{'Content-Type':'application/json'},credentials:'same-origin'}; if(body)o.body=JSON.stringify(body); const r=await fetch(path,o); const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||r.statusText); return d; }
  let records=[];
  function badge(s){ return '<span class="badge badge-'+s+'">'+s.replace('_',' ')+'</span>'; }
  function render(){
    const q=(document.getElementById('filter').value||'').toLowerCase();
    const st=document.getElementById('status-filter').value;
    let rows=records.slice();
    if(q)rows=rows.filter(r=>(r.title||'').toLowerCase().includes(q));
    if(st)rows=rows.filter(r=>r.status===st);
    document.getElementById('rows').innerHTML=rows.map(r=>\`<tr>
      <td><strong>\${esc(r.title)}</strong><div class="muted small">\${esc(r.description||'')}</div></td>
      ${fieldsDataCells}
      <td>\${badge(r.status)}</td>
      <td class="small muted">\${esc((r.updated_at||'').slice(0,19).replace('T',' '))}</td>
      <td><button class="btn btn-ghost" data-edit="\${r.id}">Edit</button> <button class="btn btn-danger" data-del="\${r.id}">Delete</button></td>
    </tr>\`).join('')||'<tr><td colspan="6" class="muted center">No ${esc(spec.entityNamePlural.toLowerCase())} yet</td></tr>';
    const counts={open:0,in_progress:0,done:0,archived:0};
    records.forEach(r=>{ if(counts[r.status]!==undefined)counts[r.status]++; });
    document.getElementById('stats').innerHTML=Object.entries(counts).map(([k,v])=>\`<div class="stat"><div class="label">\${k.replace('_',' ')}</div><div class="value">\${v}</div></div>\`).join('');
  }
  async function load(){
    try{
      const me=await api('GET','/api/auth/me');
      document.getElementById('user-label').textContent=me.name+' ('+me.role+')';
      records=await api('GET','/api/records');
      render();
    } catch(e){ window.location.href='/login.html'; }
  }
  document.getElementById('filter').addEventListener('input',render);
  document.getElementById('status-filter').addEventListener('change',render);
  document.getElementById('btn-new').addEventListener('click',()=>{
    document.getElementById('modal-title').textContent='New ${esc(spec.entityName)}';
    document.getElementById('record-id').value='';
    document.getElementById('form').reset();
    document.getElementById('modal-error').hidden=true;
    document.getElementById('modal').hidden=false;
  });
  document.getElementById('btn-cancel').addEventListener('click',()=>{ document.getElementById('modal').hidden=true; });
  document.getElementById('form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const id=document.getElementById('record-id').value;
    const body={ title:document.getElementById('field-title').value, ${fieldBody} status:document.getElementById('field-status').value };
    try{
      if(id) await api('PUT','/api/records/'+id,body);
      else await api('POST','/api/records',body);
      document.getElementById('modal').hidden=true;
      await load();
    }catch(err){ const el=document.getElementById('modal-error'); el.textContent=err.message; el.hidden=false; }
  });
  document.getElementById('rows').addEventListener('click',async(e)=>{
    const edit=e.target.getAttribute('data-edit');
    const del=e.target.getAttribute('data-del');
    if(edit){
      const r=records.find(x=>String(x.id)===edit); if(!r)return;
      document.getElementById('modal-title').textContent='Edit ${esc(spec.entityName)}';
      document.getElementById('record-id').value=r.id;
      document.getElementById('field-title').value=r.title||'';
      ${fieldPopulate}
      document.getElementById('field-status').value=r.status||'open';
      document.getElementById('modal-error').hidden=true;
      document.getElementById('modal').hidden=false;
    }
    if(del&&confirm('Delete this ${esc(spec.entityName.toLowerCase())}?')){
      try{ await api('DELETE','/api/records/'+del); await load(); }catch(err){ alert(err.message); }
    }
  });
  document.getElementById('logout-link').addEventListener('click',async(e)=>{
    e.preventDefault(); await api('POST','/api/auth/logout'); window.location.href='/login.html';
  });
  load();
</script>
</body>
</html>`;
}

// ─── Attendance page (generated if module enabled) ────────────────────────────

function generateAttendancePage(spec) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Attendance — ${esc(spec.appName)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand">${esc(spec.appName)}</div>
    <a href="/">${esc(spec.entityNamePlural)}</a>
    <a href="/attendance.html" class="active">Attendance</a>
    <a href="#" id="logout-link">Logout</a>
  </aside>
  <div class="main">
    <header class="topbar">
      <h2>Employee Attendance</h2>
      <div class="toolbar">
        <span class="muted small" id="user-label"></span>
        <button class="btn btn-primary" id="btn-new">New Entry</button>
      </div>
    </header>
    <div class="content">
      <div class="panel">
        <div class="panel-header">
          <strong>Attendance records</strong>
          <div class="toolbar">
            <input type="search" id="filter-emp" placeholder="Filter by employee…" />
            <input type="date" id="filter-date" />
          </div>
        </div>
        <div class="panel-body">
          <table>
            <thead><tr><th>Employee</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th><th></th></tr></thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="modal-backdrop" id="modal" hidden>
  <div class="modal">
    <h3 id="modal-title">New Attendance Entry</h3>
    <div id="modal-error" class="error" hidden></div>
    <form id="form">
      <input type="hidden" id="att-id" />
      <label>Employee Name<input type="text" id="emp-name" required /></label>
      <label>Date<input type="date" id="att-date" required /></label>
      <label>Check In<input type="time" id="check-in" /></label>
      <label>Check Out<input type="time" id="check-out" /></label>
      <label>Status
        <select id="att-status">
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="half_day">Half Day</option>
        </select>
      </label>
      <label>Notes<textarea id="att-notes" rows="2"></textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
</div>
<script>
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function api(m,p,b){ const o={method:m,headers:{'Content-Type':'application/json'},credentials:'same-origin'}; if(b)o.body=JSON.stringify(b); const r=await fetch(p,o); const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||r.statusText); return d; }
  let rows=[];
  function badgeAtt(s){ const map={present:'badge-done',absent:'badge-archived',late:'badge-in_progress',half_day:'badge-open'}; return '<span class="badge '+(map[s]||'')+'">'+esc(s.replace('_',' '))+'</span>'; }
  function render(){
    const emp=(document.getElementById('filter-emp').value||'').toLowerCase();
    const date=document.getElementById('filter-date').value;
    let data=rows.slice();
    if(emp)data=data.filter(r=>(r.employee_name||'').toLowerCase().includes(emp));
    if(date)data=data.filter(r=>r.date===date);
    document.getElementById('rows').innerHTML=data.map(r=>\`<tr>
      <td><strong>\${esc(r.employee_name)}</strong></td>
      <td>\${esc(r.date)}</td>
      <td>\${esc(r.check_in||'—')}</td>
      <td>\${esc(r.check_out||'—')}</td>
      <td>\${badgeAtt(r.status)}</td>
      <td><button class="btn btn-ghost" data-edit="\${r.id}">Edit</button> <button class="btn btn-danger" data-del="\${r.id}">Delete</button></td>
    </tr>\`).join('')||'<tr><td colspan="6" class="muted center">No attendance entries yet</td></tr>';
  }
  async function load(){
    try{
      const me=await api('GET','/api/auth/me');
      document.getElementById('user-label').textContent=me.name+' ('+me.role+')';
      rows=await api('GET','/api/attendance');
      render();
    }catch(e){ window.location.href='/login.html'; }
  }
  document.getElementById('filter-emp').addEventListener('input',render);
  document.getElementById('filter-date').addEventListener('change',render);
  document.getElementById('btn-new').addEventListener('click',()=>{
    document.getElementById('modal-title').textContent='New Attendance Entry';
    document.getElementById('att-id').value='';
    document.getElementById('emp-name').value='';
    document.getElementById('att-date').value=new Date().toISOString().slice(0,10);
    document.getElementById('check-in').value=''; document.getElementById('check-out').value='';
    document.getElementById('att-status').value='present'; document.getElementById('att-notes').value='';
    document.getElementById('modal-error').hidden=true; document.getElementById('modal').hidden=false;
  });
  document.getElementById('btn-cancel').addEventListener('click',()=>{ document.getElementById('modal').hidden=true; });
  document.getElementById('form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const id=document.getElementById('att-id').value;
    const body={employee_name:document.getElementById('emp-name').value,date:document.getElementById('att-date').value,check_in:document.getElementById('check-in').value,check_out:document.getElementById('check-out').value,status:document.getElementById('att-status').value,notes:document.getElementById('att-notes').value};
    try{
      if(id) await api('PUT','/api/attendance/'+id,body); else await api('POST','/api/attendance',body);
      document.getElementById('modal').hidden=true; await load();
    }catch(err){ const el=document.getElementById('modal-error'); el.textContent=err.message; el.hidden=false; }
  });
  document.getElementById('rows').addEventListener('click',async(e)=>{
    const edit=e.target.getAttribute('data-edit');
    const del=e.target.getAttribute('data-del');
    if(edit){
      const r=rows.find(x=>String(x.id)===edit); if(!r)return;
      document.getElementById('modal-title').textContent='Edit Entry';
      document.getElementById('att-id').value=r.id;
      document.getElementById('emp-name').value=r.employee_name||'';
      document.getElementById('att-date').value=r.date||'';
      document.getElementById('check-in').value=r.check_in||'';
      document.getElementById('check-out').value=r.check_out||'';
      document.getElementById('att-status').value=r.status||'present';
      document.getElementById('att-notes').value=r.notes||'';
      document.getElementById('modal-error').hidden=true; document.getElementById('modal').hidden=false;
    }
    if(del&&confirm('Delete this entry?')){ try{ await api('DELETE','/api/attendance/'+del); await load(); }catch(err){ alert(err.message); } }
  });
  document.getElementById('logout-link').addEventListener('click',async(e)=>{ e.preventDefault(); await api('POST','/api/auth/logout'); window.location.href='/login.html'; });
  load();
</script>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

function cap(s) {
  return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1).replace(/_/g, ' ');
}

// ─── Main generate function ───────────────────────────────────────────────────

/**
 * @param {object} spec  – from aiService.generateAppSpec()
 * @param {string} projectId
 * @returns {{ version: string, files: string[], at: string }}
 */
function generateApp(spec, projectId) {
  // 1. Normalize spec
  const safeSpec = {
    appName: String(spec.appName || 'Generated App').slice(0, 60),
    businessName: String(spec.businessName || '').slice(0, 60),
    entityName: String(spec.entityName || 'Record'),
    entityNamePlural: String(spec.entityNamePlural || 'Records'),
    entityFields: Array.isArray(spec.entityFields) ? spec.entityFields.filter((f) => f.name && f.name !== 'title' && f.name !== 'status' && f.name !== 'description') : [],
    modules: Array.isArray(spec.modules) ? spec.modules : [],
    userRoles: Array.isArray(spec.userRoles) ? spec.userRoles : ['admin', 'user'],
    pages: Array.isArray(spec.pages) ? spec.pages : ['index.html', 'login.html', 'register.html'],
  };

  const touched = [];

  // 2. Update config.json
  const oldConfig = readJsonFile('config.json', { version: '1.0.0' });
  const newVersion = bumpVersion(oldConfig.version || '1.0.0');
  const newConfig = {
    appName: safeSpec.appName,
    businessName: safeSpec.businessName,
    entityName: safeSpec.entityName,
    entityNamePlural: safeSpec.entityNamePlural,
    projectId: projectId || oldConfig.projectId || null,
    port: oldConfig.port || 3847,
    version: newVersion,
    generatedAt: new Date().toISOString(),
  };
  writeJsonFile('config.json', newConfig);
  touched.push('config.json');

  // 3. Write CSS
  writeFile('public/styles.css', generateCSS());
  touched.push('public/styles.css');

  // 4. Write login + register
  writeFile('public/login.html', generateLoginPage(safeSpec));
  writeFile('public/register.html', generateRegisterPage(safeSpec));
  touched.push('public/login.html', 'public/register.html');

  // 5. Write main index page
  writeFile('public/index.html', generateIndexPage(safeSpec));
  touched.push('public/index.html');

  // 6. Enable/write modules
  const enabled = [];
  if (safeSpec.modules.includes('attendance')) {
    enabled.push('attendance');
    writeFile('public/attendance.html', generateAttendancePage(safeSpec));
    touched.push('public/attendance.html');
  }
  writeJsonFile('modules/enabled.json', enabled);
  touched.push('modules/enabled.json');

  // 7. Write changelog entry
  let changelog = readJsonFile('data/changelog.json', []);
  changelog = Array.isArray(changelog) ? changelog : [];
  changelog.unshift({
    version: newVersion,
    projectId: projectId || null,
    action: 'generate',
    spec: { appName: safeSpec.appName, entityName: safeSpec.entityName, modules: safeSpec.modules },
    filesTouched: touched,
    at: new Date().toISOString(),
  });
  writeJsonFile('data/changelog.json', changelog);
  touched.push('data/changelog.json');

  return { version: newVersion, files: touched, at: new Date().toISOString() };
}

/**
 * Apply an incremental modification — adds new modules without full regeneration.
 * @param {object} plan   – from aiService.analyzeModification()
 * @param {object} currentSpec
 * @param {string} projectId
 */
function applyModification(plan, currentSpec, projectId) {
  const touched = [];
  const config = readJsonFile('config.json', { version: '1.0.0' });
  const newVersion = bumpVersion(config.version || '1.0.0');

  const safeSpec = {
    appName: config.appName || 'Generated App',
    businessName: config.businessName || '',
    entityName: config.entityName || 'Record',
    entityNamePlural: config.entityNamePlural || 'Records',
    entityFields: Array.isArray(currentSpec?.entityFields) ? currentSpec.entityFields : [],
    modules: Array.isArray(currentSpec?.modules) ? currentSpec.modules : [],
    userRoles: ['admin', 'user'],
    pages: [],
  };

  // Add new modules
  if (Array.isArray(plan.newModules)) {
    plan.newModules.forEach((mod) => {
      if (!safeSpec.modules.includes(mod)) safeSpec.modules.push(mod);
    });
  }

  // Enable attendance if requested
  const needsAttendance = safeSpec.modules.includes('attendance');
  if (needsAttendance) {
    writeFile('public/attendance.html', generateAttendancePage(safeSpec));
    touched.push('public/attendance.html');
  }

  const enabled = readJsonFile('modules/enabled.json', []);
  const newEnabled = Array.isArray(enabled) ? [...enabled] : [];
  safeSpec.modules.forEach((m) => { if (!newEnabled.includes(m)) newEnabled.push(m); });
  writeJsonFile('modules/enabled.json', newEnabled);
  touched.push('modules/enabled.json');

  // Bump version in config
  config.version = newVersion;
  config.lastChange = { summary: plan.summary, at: new Date().toISOString() };
  writeJsonFile('config.json', config);
  touched.push('config.json');

  // Changelog
  let changelog = readJsonFile('data/changelog.json', []);
  changelog = Array.isArray(changelog) ? changelog : [];
  changelog.unshift({
    version: newVersion,
    projectId: projectId || null,
    action: 'modify',
    plan: { summary: plan.summary, newModules: plan.newModules, steps: plan.steps },
    filesTouched: touched,
    at: new Date().toISOString(),
  });
  writeJsonFile('data/changelog.json', changelog);
  touched.push('data/changelog.json');

  return { version: newVersion, files: touched, at: new Date().toISOString() };
}

module.exports = { generateApp, applyModification };
