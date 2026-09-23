#!/usr/bin/env node
/**
 * Apply an incremental change to the existing app (does not regenerate everything).
 * Usage: node scripts/apply-change.js attendance
 *        node scripts/apply-change.js --list
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const enabledPath = path.join(root, 'modules', 'enabled.json');
const configPath = path.join(root, 'config.json');
const changelogPath = path.join(root, 'data', 'changelog.json');

const CATALOG = {
  attendance: {
    id: 'attendance',
    title: 'Employee Attendance',
    filesTouched: [
      'modules/attendance.js',
      'modules/enabled.json',
      'public/attendance.html',
      'config.json (version bump)',
      'data/changelog.json',
    ],
    description: 'Adds attendance CRUD API and UI without replacing core records/auth.',
  },
};

function bumpVersion(v) {
  const s = String(v || '1.0').replace(/^v/i, '');
  const parts = s.split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 2) parts.push(0);
  // major.minor (v1.0, v1.1, …)
  parts[1] += 1;
  return parts[0] + '.' + parts[1];
}

function loadEnabled() {
  try {
    const arr = JSON.parse(fs.readFileSync(enabledPath, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function main() {
  const arg = process.argv[2];
  if (!arg || arg === '--list') {
    console.log('Available modules:', Object.keys(CATALOG).join(', ') || '(none)');
    console.log('Enabled:', loadEnabled().join(', ') || '(none)');
    process.exit(0);
  }

  const mod = CATALOG[arg];
  if (!mod) {
    console.error('Unknown change module:', arg);
    console.error('Known:', Object.keys(CATALOG).join(', '));
    process.exit(1);
  }

  const modFile = path.join(root, 'modules', arg + '.js');
  if (!fs.existsSync(modFile)) {
    console.error('Module file missing:', modFile);
    process.exit(1);
  }

  // Ensure attendance UI exists
  const uiPath = path.join(root, 'public', 'attendance.html');
  if (arg === 'attendance' && !fs.existsSync(uiPath)) {
    console.error('attendance.html missing — run generator UI assets first');
    process.exit(1);
  }

  let enabled = loadEnabled();
  if (!enabled.includes(arg)) {
    enabled.push(arg);
    fs.writeFileSync(enabledPath, JSON.stringify(enabled, null, 2));
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const prev = config.version || '1.0.0';
  config.version = bumpVersion(prev);
  config.lastChange = {
    module: arg,
    title: mod.title,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  let log = [];
  try {
    log = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  } catch (_) {}
  log.unshift({
    version: config.version,
    module: arg,
    title: mod.title,
    filesTouched: mod.filesTouched,
    at: new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(changelogPath), { recursive: true });
  fs.writeFileSync(changelogPath, JSON.stringify(log, null, 2));

  console.log(JSON.stringify({
    ok: true,
    module: arg,
    version: config.version,
    previousVersion: prev,
    enabled,
    filesTouched: mod.filesTouched,
  }, null, 2));
}

main();
