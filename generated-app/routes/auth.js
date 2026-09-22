const express = require('express');
const db = require('../db');

const router = express.Router();

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db.getUserByEmail(email);
  if (!user || !db.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.name = user.name;
  req.session.role = user.role;
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post('/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim();
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const user = db.createUser({
    email,
    password_hash: db.hashPassword(password),
    name,
    role: 'user',
  });
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.name = user.name;
  req.session.role = user.role;
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = db.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    created_at: user.created_at,
  });
});

module.exports = router;
