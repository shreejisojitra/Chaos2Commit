/**
 * Incremental module: Employee Attendance
 * Loaded only when listed in modules/enabled.json
 */
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const storePath = path.join(dataDir, 'store.json');

function loadStore() {
  if (!fs.existsSync(storePath)) {
    return { users: [], records: [], attendance: [], seq: { users: 1, records: 1, attendance: 1 } };
  }
  const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  if (!data.attendance) data.attendance = [];
  if (!data.seq) data.seq = { users: 1, records: 1, attendance: 1 };
  if (!data.seq.attendance) data.seq.attendance = 1;
  return data;
}

function saveStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

const attendanceApi = {
  list(filter = {}) {
    let rows = loadStore().attendance.slice();
    if (filter.employee) {
      const q = String(filter.employee).toLowerCase();
      rows = rows.filter((r) => (r.employee_name || '').toLowerCase().includes(q));
    }
    if (filter.date) rows = rows.filter((r) => r.date === filter.date);
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
    return rows;
  },
  get(id) {
    return loadStore().attendance.find((r) => r.id === Number(id)) || null;
  },
  create({ employee_name, date, check_in, check_out, status, notes, created_by }) {
    const data = loadStore();
    const row = {
      id: data.seq.attendance++,
      employee_name: String(employee_name || '').trim(),
      date: date || new Date().toISOString().slice(0, 10),
      check_in: check_in || '',
      check_out: check_out || '',
      status: status || 'present',
      notes: notes || '',
      created_by: created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!row.employee_name) throw new Error('Employee name is required');
    data.attendance.push(row);
    saveStore(data);
    return row;
  },
  update(id, fields) {
    const data = loadStore();
    const idx = data.attendance.findIndex((r) => r.id === Number(id));
    if (idx === -1) return null;
    data.attendance[idx] = {
      ...data.attendance[idx],
      ...fields,
      updated_at: new Date().toISOString(),
    };
    saveStore(data);
    return data.attendance[idx];
  },
  remove(id) {
    const data = loadStore();
    const before = data.attendance.length;
    data.attendance = data.attendance.filter((r) => r.id !== Number(id));
    if (data.attendance.length === before) return false;
    saveStore(data);
    return true;
  },
};

/**
 * Handle /api/attendance routes. Returns true if handled.
 */
function handleRequest(ctx) {
  const { method, pathname, url, sess, body, sendJson } = ctx;
  if (!pathname.startsWith('/api/attendance')) return false;

  if (!sess || !sess.data.userId) {
    sendJson(401, { error: 'Authentication required' });
    return true;
  }

  if (method === 'GET' && pathname === '/api/attendance') {
    sendJson(200, attendanceApi.list({
      employee: url.searchParams.get('employee') || undefined,
      date: url.searchParams.get('date') || undefined,
    }));
    return true;
  }

  const one = pathname.match(/^\/api\/attendance\/(\d+)$/);
  if (one && method === 'GET') {
    const row = attendanceApi.get(one[1]);
    if (!row) sendJson(404, { error: 'Attendance record not found' });
    else sendJson(200, row);
    return true;
  }

  if (method === 'POST' && pathname === '/api/attendance') {
    try {
      const row = attendanceApi.create({
        employee_name: body.employee_name,
        date: body.date,
        check_in: body.check_in,
        check_out: body.check_out,
        status: body.status,
        notes: body.notes,
        created_by: sess.data.userId,
      });
      sendJson(201, row);
    } catch (e) {
      sendJson(400, { error: e.message || 'Invalid attendance payload' });
    }
    return true;
  }

  if (one && method === 'PUT') {
    const existing = attendanceApi.get(one[1]);
    if (!existing) {
      sendJson(404, { error: 'Attendance record not found' });
      return true;
    }
    const row = attendanceApi.update(existing.id, {
      employee_name: body.employee_name !== undefined ? String(body.employee_name).trim() : existing.employee_name,
      date: body.date !== undefined ? body.date : existing.date,
      check_in: body.check_in !== undefined ? body.check_in : existing.check_in,
      check_out: body.check_out !== undefined ? body.check_out : existing.check_out,
      status: body.status !== undefined ? body.status : existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    });
    sendJson(200, row);
    return true;
  }

  if (one && method === 'DELETE') {
    if (!attendanceApi.remove(one[1])) {
      sendJson(404, { error: 'Attendance record not found' });
      return true;
    }
    sendJson(200, { ok: true, id: Number(one[1]) });
    return true;
  }

  sendJson(404, { error: 'Not found' });
  return true;
}

module.exports = {
  id: 'attendance',
  name: 'Employee Attendance',
  handleRequest,
  attendanceApi,
};
