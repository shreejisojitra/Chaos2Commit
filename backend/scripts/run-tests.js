#!/usr/bin/env node
/**
 * Smoke tests against a running server (default http://127.0.0.1:3847)
 */
const http = require('http');

const BASE = process.env.APP_URL || 'http://127.0.0.1:3847';

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (cookie) opts.headers.Cookie = cookie;
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, json, raw, setCookie });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function cookieFrom(res) {
  if (!res.setCookie || !res.setCookie[0]) return '';
  return res.setCookie[0].split(';')[0];
}

async function main() {
  const results = [];
  function ok(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  }

  try {
    const health = await request('GET', '/api/health');
    ok('health', health.status === 200 && health.json && health.json.ok);

    const login = await request('POST', '/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123',
    });
    const cookie = cookieFrom(login);
    ok('login', login.status === 200 && !!cookie, cookie ? 'session cookie set' : 'no cookie');

    const create = await request('POST', '/api/records', {
      title: 'Test record ' + Date.now(),
      status: 'open',
    }, cookie);
    ok('create record', create.status === 201 && create.json && create.json.id);

    const list = await request('GET', '/api/records', null, cookie);
    ok('list records', list.status === 200 && Array.isArray(list.json));

    // Attendance module tests (if enabled)
    const config = await request('GET', '/api/config');
    const modules = (config.json && config.json.modules) || [];
    if (modules.includes('attendance')) {
      const att = await request('POST', '/api/attendance', {
        employee_name: 'Test Employee',
        date: new Date().toISOString().slice(0, 10),
        check_in: '09:00',
        status: 'present',
      }, cookie);
      ok('create attendance', att.status === 201 && att.json && att.json.id);
      const attList = await request('GET', '/api/attendance', null, cookie);
      ok('list attendance', attList.status === 200 && Array.isArray(attList.json));
    } else {
      ok('attendance module (skipped)', true, 'not enabled');
    }

    const failed = results.filter((r) => !r.pass);
    console.log('\n' + results.length + ' tests, ' + failed.length + ' failed');
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error('Test runner error:', e.message);
    console.error('Is the server running at', BASE, '?');
    process.exit(2);
  }
}

main();
