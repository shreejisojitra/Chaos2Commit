/**
 * Builder user store — separate from the generated app's db.js
 * Stores builder platform users in data/builder-users.json
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR  = path.join(__dirname, 'data');
const USERS_PATH = path.join(DATA_DIR, 'builder-users.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), test);
}

function load() {
  ensureDir();
  if (!fs.existsSync(USERS_PATH)) return { users: [], seq: 1 };
  try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); }
  catch (_) { return { users: [], seq: 1 }; }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));
}

const builderDb = {
  hashPassword,
  verifyPassword,

  getUserByEmail(email) {
    return load().users.find(u => u.email === email) || null;
  },

  getUserById(id) {
    return load().users.find(u => u.id === id) || null;
  },

  createUser({ name, email, password }) {
    const data = load();
    if (data.users.find(u => u.email === email)) {
      throw Object.assign(new Error('Email already registered'), { status: 409 });
    }
    const user = {
      id: 'bu_' + crypto.randomBytes(8).toString('hex'),
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password_hash: hashPassword(password),
      plan: 'free',
      credits: 100,
      creditsUsed: 0,
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    data.seq = (data.seq || 1) + 1;
    save(data);
    return user;
  },

  updateCredits(userId, spent) {
    const data = load();
    const idx = data.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    data.users[idx].credits     = Math.max(0, (data.users[idx].credits || 0) - spent);
    data.users[idx].creditsUsed = (data.users[idx].creditsUsed || 0) + spent;
    save(data);
    return data.users[idx];
  },

  getPublic(user) {
    if (!user) return null;
    const { password_hash, ...pub } = user;
    return pub;
  },

  list() {
    return load().users.map(u => this.getPublic(u));
  },
};

module.exports = builderDb;
