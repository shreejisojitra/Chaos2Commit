const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'store.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, 'hex');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(hashBuffer, test);
}

function load() {
  if (!fs.existsSync(dbPath)) {
    return { users: [], records: [], seq: { users: 1, records: 1 } };
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function save(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function ensureSeed() {
  const data = load();
  let changed = false;
  if (!data.users.find((u) => u.email === 'admin@example.com')) {
    data.users.push({
      id: data.seq.users++,
      email: 'admin@example.com',
      password_hash: hashPassword('admin123'),
      name: 'Admin User',
      role: 'admin',
      created_at: new Date().toISOString(),
    });
    changed = true;
  }
  if (!data.users.find((u) => u.email === 'user@example.com')) {
    data.users.push({
      id: data.seq.users++,
      email: 'user@example.com',
      password_hash: hashPassword('user123'),
      name: 'Standard User',
      role: 'user',
      created_at: new Date().toISOString(),
    });
    changed = true;
  }
  if (changed) save(data);
}

(function migrate() {
  if (!fs.existsSync(dbPath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const admin = data.users && data.users.find((u) => u.email === 'admin@example.com');
    if (admin && admin.password_hash && !String(admin.password_hash).includes(':')) {
      fs.unlinkSync(dbPath);
    }
  } catch (_) {}
})();

ensureSeed();

const db = {
  hashPassword,
  verifyPassword,
  getUserByEmail(email) {
    return load().users.find((u) => u.email === email) || null;
  },
  getUserById(id) {
    return load().users.find((u) => u.id === Number(id)) || null;
  },
  createUser({ email, password_hash, name, role }) {
    const data = load();
    const user = {
      id: data.seq.users++,
      email,
      password_hash,
      name,
      role: role || 'user',
      created_at: new Date().toISOString(),
    };
    data.users.push(user);
    save(data);
    return user;
  },
  listRecords({ status, q } = {}) {
    const data = load();
    let rows = data.records.map((r) => {
      const owner = data.users.find((u) => u.id === r.owner_id);
      return {
        ...r,
        owner_name: owner ? owner.name : null,
        owner_email: owner ? owner.email : null,
      };
    });
    if (status) rows = rows.filter((r) => r.status === status);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.title || '').toLowerCase().includes(needle) ||
          (r.description || '').toLowerCase().includes(needle)
      );
    }
    rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return rows;
  },
  getRecord(id) {
    const data = load();
    const r = data.records.find((x) => x.id === Number(id));
    if (!r) return null;
    const owner = data.users.find((u) => u.id === r.owner_id);
    return {
      ...r,
      owner_name: owner ? owner.name : null,
      owner_email: owner ? owner.email : null,
    };
  },
  createRecord({ title, description, status, owner_id }) {
    const data = load();
    const now = new Date().toISOString();
    const record = {
      id: data.seq.records++,
      title,
      description: description || '',
      status: status || 'open',
      owner_id,
      created_at: now,
      updated_at: now,
    };
    data.records.push(record);
    save(data);
    return this.getRecord(record.id);
  },
  updateRecord(id, fields) {
    const data = load();
    const idx = data.records.findIndex((r) => r.id === Number(id));
    if (idx === -1) return null;
    data.records[idx] = {
      ...data.records[idx],
      ...fields,
      updated_at: new Date().toISOString(),
    };
    save(data);
    return this.getRecord(id);
  },
  deleteRecord(id) {
    const data = load();
    const before = data.records.length;
    data.records = data.records.filter((r) => r.id !== Number(id));
    if (data.records.length === before) return false;
    save(data);
    return true;
  },
};

module.exports = db;
