// Full end-to-end test of all AI endpoints
const BASE = 'http://127.0.0.1:3847';

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch(_) { json = { raw: text.substring(0, 200) }; }
  return { status: r.status, ok: r.ok, json };
}

async function run() {
  console.log('=== Testing all AI endpoints ===\n');

  // 1. Health
  const h = await fetch(BASE + '/api/health').then(r => r.json());
  console.log('Health:', h.ok, '| AI:', h.aiConfigured);

  // 2. Chat
  console.log('\n--- /api/ai/chat ---');
  const chat = await post('/api/ai/chat', {
    projectId: 'test',
    message: 'HR consultancy software for managing candidates',
    conversation: [],
    projectContext: { idea: 'HR consultancy' }
  });
  console.log('Status:', chat.status);
  if (chat.ok) {
    console.log('Source:', chat.json.source);
    console.log('Understanding:', chat.json.analysis?.businessUnderstanding?.substring(0, 80));
  } else {
    console.log('ERROR:', chat.json.error || chat.json.raw);
  }

  // 3. Blueprint
  console.log('\n--- /api/ai/blueprint ---');
  const bp = await post('/api/ai/blueprint', {
    projectId: 'test',
    projectContext: { idea: 'HR consultancy software' },
    consultantAnalysis: {
      businessUnderstanding: 'HR consultancy platform',
      explicitRequirements: [{ text: 'Candidate management', evidence: 'user', confidence: 0.9 }],
      recommendations: []
    }
  });
  console.log('Status:', bp.status);
  if (bp.ok) {
    console.log('Product:', bp.json.blueprint?.productName);
  } else {
    console.log('ERROR:', bp.json.error || bp.json.raw);
  }

  // 4. Architecture (needs blueprint)
  console.log('\n--- /api/ai/architecture ---');
  const arch = await post('/api/ai/architecture', {
    projectId: 'test',
    blueprint: {
      productName: 'HR Manager',
      coreModules: [{ id: 'auth', name: 'Auth', description: 'Login', priority: 'must-have' }],
      dataEntities: [{ name: 'Candidate', fields: ['name', 'email', 'status'] }],
      userRoles: ['admin', 'user'],
      techStack: { backend: 'Node.js', frontend: 'HTML/JS', database: 'JSON', deployment: 'Render' }
    }
  });
  console.log('Status:', arch.status);
  if (arch.ok) {
    console.log('Endpoints:', arch.json.architecture?.apiEndpoints?.length);
  } else {
    console.log('ERROR:', arch.json.error || arch.json.raw);
  }

  console.log('\n=== Done ===');
}

run().catch(e => console.log('FATAL:', e.message));
