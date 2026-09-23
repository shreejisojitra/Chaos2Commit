/**
 * Server-side project store — persists builder projects to data/projects.json
 * This is the source of truth for the pipeline state.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(PROJECTS_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function save(projects) {
  ensureDir();
  fs.writeFileSync(PROJECTS_PATH, JSON.stringify(projects, null, 2));
}

const store = {
  list() {
    return load();
  },

  get(id) {
    return load().find((p) => p.id === id) || null;
  },

  upsert(project) {
    const projects = load();
    const idx = projects.findIndex((p) => p.id === project.id);
    const now = new Date().toISOString();
    const updated = { ...project, updatedAt: now };
    if (idx >= 0) {
      projects[idx] = updated;
    } else {
      updated.createdAt = updated.createdAt || now;
      projects.push(updated);
    }
    save(projects);
    return updated;
  },

  delete(id) {
    const projects = load();
    const filtered = projects.filter((p) => p.id !== id);
    save(filtered);
    return filtered.length < projects.length;
  },
};

module.exports = store;
