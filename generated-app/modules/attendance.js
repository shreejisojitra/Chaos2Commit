const db = require('../db');

module.exports = {
  name: 'attendance',
  pathPrefix: '/api/attendance',

  handle(req, res, { method, pathname, sendJson, readBody, requireAuth, getSession }) {
    const sess = requireAuth(req, res);
    if (!sess) return true;

    // List attendance records
    if (method === 'GET' && pathname === '/api/attendance') {
      const records = db.listAttendance ? db.listAttendance(sess.data.userId, sess.data.role) : [];
      sendJson(res, 200, records);
      return true;
    }

    // Mark attendance
    if (method === 'POST' && pathname === '/api/attendance') {
      return readBody(req).then((body) => {
        const employee = String(body.employee || '').trim();
        const date = String(body.date || new Date().toISOString().slice(0, 10)).trim();
        const status = String(body.status || 'present').trim();
        if (!employee) {
          sendJson(res, 400, { error: 'Employee is required' });
          return true;
        }
        const row = db.createAttendance
          ? db.createAttendance({
              employee,
              date,
              status,
              owner_id: sess.data.userId,
            })
          : { id: Date.now(), employee, date, status, owner_id: sess.data.userId };
        sendJson(res, 201, row);
        return true;
      });
    }

    // Update attendance
    if (method === 'PUT' && pathname.startsWith('/api/attendance/')) {
      const id = pathname.split('/').pop();
      return readBody(req).then((body) => {
        const existing = db.getAttendance ? db.getAttendance(id) : null;
        if (!existing) {
          sendJson(res, 404, { error: 'Attendance record not found' });
          return true;
        }
        if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) {
          sendJson(res, 403, { error: 'Forbidden' });
          return true;
        }
        const updated = db.updateAttendance
          ? db.updateAttendance(id, {
              employee: body.employee !== undefined ? String(body.employee).trim() : existing.employee,
              date: body.date !== undefined ? String(body.date).trim() : existing.date,
              status: body.status !== undefined ? String(body.status).trim() : existing.status,
            })
          : { ...existing, ...body };
        sendJson(res, 200, updated);
        return true;
      });
    }

    // Delete
    if (method === 'DELETE' && pathname.startsWith('/api/attendance/')) {
      const id = pathname.split('/').pop();
      const existing = db.getAttendance ? db.getAttendance(id) : null;
      if (!existing) {
        sendJson(res, 404, { error: 'Not found' });
        return true;
      }
      if (sess.data.role !== 'admin' && existing.owner_id !== sess.data.userId) {
        sendJson(res, 403, { error: 'Forbidden' });
        return true;
      }
      if (db.deleteAttendance) db.deleteAttendance(id);
      sendJson(res, 200, { ok: true, id });
      return true;
    }

    return false;
  },
};
