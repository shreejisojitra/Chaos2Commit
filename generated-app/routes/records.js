const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

router.use(requireAuth);

router.get('/', (req, res) => {
  const role = req.session.role;
  const userId = req.session.userId;
  const rows = role === 'admin' ? db.listRecords() : db.listRecords({ owner_id: userId });
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.getRecord(req.params.id);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  if (req.session.role !== 'admin' && row.owner_id !== req.session.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(row);
});

router.post('/', (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  let status = String(req.body.status || 'open').trim();
  const allowed = new Set(['open', 'in_progress', 'done', 'archived']);
  if (!allowed.has(status)) status = 'open';
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const row = db.createRecord({
    title,
    description,
    status,
    owner_id: req.session.userId,
  });
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.getRecord(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Record not found' });
  if (req.session.role !== 'admin' && existing.owner_id !== req.session.userId) {
    return res.status(403).json({ error: 'You can only edit your own records' });
  }
  const title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
  const description = req.body.description !== undefined ? String(req.body.description).trim() : existing.description;
  let status = req.body.status !== undefined ? String(req.body.status).trim() : existing.status;
  const allowed = new Set(['open', 'in_progress', 'done', 'archived']);
  if (!allowed.has(status)) status = existing.status;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  res.json(db.updateRecord(existing.id, { title, description, status }));
});

router.delete('/:id', (req, res) => {
  const existing = db.getRecord(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Record not found' });
  if (req.session.role !== 'admin' && existing.owner_id !== req.session.userId) {
    return res.status(403).json({ error: 'You can only delete your own records' });
  }
  db.deleteRecord(existing.id);
  res.json({ ok: true, id: existing.id });
});

module.exports = router;
