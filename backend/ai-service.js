/**
 * AI Service — Groq API (Free tier, OpenAI-compatible)
 * Model: openai/gpt-oss-120b — reliable structured JSON
 * Free at: https://console.groq.com
 */

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TURNS = 20;

function getApiKey(deps = {}) {
  const key = deps.apiKey === undefined ? process.env.GROQ_API_KEY : deps.apiKey;
  if (!key || key === 'your-groq-api-key-here') {
    const err = new Error('Groq API key not set. Add GROQ_API_KEY to backend/.env and restart. Free key at https://console.groq.com');
    err.status = 503;
    throw err;
  }
  return key;
}

function getModel(deps = {}) {
  return deps.model || process.env.GROQ_MODEL || DEFAULT_MODEL;
}

// Core Groq call with retry + robust JSON extraction
async function callGroq(apiKey, model, systemPrompt, userMessage, deps = {}, retries = 2) {
  const fetchImpl = deps.fetch || global.fetch;
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature: 0.3,
    max_tokens: 2500,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (_) {
      if (attempt < retries) continue;
      const e = new Error('Could not reach Groq. Check your internet connection.'); e.status = 502; throw e;
    }

    if (!response.ok) {
      let msg = `Groq error (${response.status}).`;
      try { const b = await response.json(); if (b.error?.message) msg = b.error.message; } catch (_) {}
      if (attempt < retries) { await sleep(1000); continue; }
      const e = new Error(msg); e.status = 502; throw e;
    }

    let payload;
    try { payload = await response.json(); } catch (_) {
      if (attempt < retries) continue;
      const e = new Error('Groq returned an unreadable response.'); e.status = 502; throw e;
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      if (attempt < retries) { await sleep(800); continue; }
      const e = new Error('Groq returned an empty response.'); e.status = 502; throw e;
    }

    // Strip fences, find JSON object
    const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      if (attempt < retries) { await sleep(800); continue; }
      const e = new Error('AI response was not valid JSON. Try again.'); e.status = 502; throw e;
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {
      if (attempt < retries) { await sleep(800); continue; }
      const e = new Error('AI response was not valid JSON. Try again.'); e.status = 502; throw e;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanConversation(conversation) {
  if (!Array.isArray(conversation)) return [];
  return conversation.slice(-MAX_TURNS).flatMap((item) => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') return [];
    return [{ role: item.role, content: item.content.slice(0, MAX_MESSAGE_LENGTH) }];
  });
}

// ─── 1. AI Consultant ──────────────────────────────────────────────────────────

async function analyze({ message, conversation = [], projectContext = {} }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const contextParts = [
    projectContext.idea         && `Business idea: ${projectContext.idea.slice(0, 5000)}`,
    projectContext.requirements && `Requirements: ${projectContext.requirements.slice(0, 3000)}`,
    projectContext.process      && `Existing process: ${projectContext.process.slice(0, 3000)}`,
    projectContext.docText      && `Document text: ${projectContext.docText.slice(0, 6000)}`,
  ].filter(Boolean).join('\n\n');

  const systemPrompt = `You are a concise business and software requirements consultant.
Analyse the user's business idea and return a structured JSON analysis.
Use evidence only from what the user provided. When evidence is absent use "Not provided by user".
Keep confidence values between 0 and 1.
Return ONLY valid JSON, no markdown:
{
  "businessUnderstanding": "2-3 sentence summary",
  "targetUsers": ["User type 1"],
  "explicitRequirements": [{"text": "requirement", "evidence": "source", "confidence": 0.9}],
  "missingRequirements": ["Missing item"],
  "questions": ["Question?"],
  "recommendations": [{"text": "recommendation", "explanation": "why", "confidence": 0.8}],
  "assumptions": ["Assumption"]
}
${contextParts ? '\nProject context:\n' + contextParts : ''}`;

  const history = cleanConversation(conversation);
  const historyText = history.length
    ? history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\n\n'
    : '';
  const userMessage = `${historyText}User: ${message.slice(0, MAX_MESSAGE_LENGTH)}\n\nAnalyse this business and return the JSON.`;
  return callGroq(apiKey, model, systemPrompt, userMessage, deps);
}

// ─── 2. Blueprint ──────────────────────────────────────────────────────────────

async function generateBlueprint({ projectContext, consultantAnalysis }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const contextParts = [
    consultantAnalysis?.businessUnderstanding && `Business: ${consultantAnalysis.businessUnderstanding}`,
    consultantAnalysis?.explicitRequirements?.length &&
      `Requirements:\n${consultantAnalysis.explicitRequirements.map(r => `- ${r.text}`).join('\n')}`,
    consultantAnalysis?.recommendations?.length &&
      `Recommendations:\n${consultantAnalysis.recommendations.map(r => `- ${r.text}`).join('\n')}`,
    projectContext?.idea         && `Idea: ${projectContext.idea.slice(0, 2000)}`,
    projectContext?.requirements && `User requirements: ${projectContext.requirements.slice(0, 2000)}`,
  ].filter(Boolean).join('\n\n');

  const systemPrompt = `You are a senior software architect.
Produce a detailed product blueprint. Return ONLY valid JSON, no markdown:
{
  "productName": "short name",
  "productDescription": "2-3 sentences",
  "targetUsers": ["type"],
  "coreModules": [{"id": "auth", "name": "Authentication", "description": "desc", "priority": "must-have"}],
  "dataEntities": [{"name": "User", "fields": ["id", "email", "name"]}],
  "userRoles": ["admin", "user"],
  "keyFlows": ["flow description"],
  "nonFunctionalRequirements": ["requirement"],
  "techStack": {"backend": "Node.js", "frontend": "HTML/CSS/JS", "database": "JSON file store", "deployment": "Render"}
}`;

  return callGroq(apiKey, model, systemPrompt, `Generate blueprint for:\n\n${contextParts}`, deps);
}

// ─── 3. Architecture ───────────────────────────────────────────────────────────

async function generateArchitecture({ blueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = `You are a senior software architect. Produce a system architecture spec.
systemDiagram: valid Mermaid flowchart LR (NO backtick fences, use \\n for newlines in JSON string).
erDiagram: valid Mermaid erDiagram (NO backtick fences, use \\n for newlines in JSON string).
Return ONLY valid JSON, no markdown:
{
  "systemDiagram": "flowchart LR\\n  Client[Browser] --> API[Node API]\\n  API --> DB[(Store)]",
  "erDiagram": "erDiagram\\n  USER ||--o{ RECORD : creates\\n  USER {\\n    string id\\n    string email\\n  }",
  "apiEndpoints": [{"method": "GET", "path": "/api/records", "description": "List records", "auth": true}],
  "sitemap": ["Login", "Dashboard", "Records"],
  "securityNotes": ["Passwords hashed with scrypt"]
}`;

  const userMessage = `Generate architecture for:
Product: ${blueprint.productName}
Modules: ${blueprint.coreModules.map(m => m.name).join(', ')}
Entities: ${blueprint.dataEntities.map(e => e.name).join(', ')}
Roles: ${blueprint.userRoles.join(', ')}
Stack: ${blueprint.techStack.backend} / ${blueprint.techStack.frontend} / ${blueprint.techStack.database}`;

  return callGroq(apiKey, model, systemPrompt, userMessage, deps);
}

// ─── 4. App Generation Spec (RICH — drives dynamic code generation) ─────────────

async function generateAppSpec({ blueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = `You are a code generation engine that produces rich, domain-specific app specs.
Your spec drives a code generator that writes completely different apps per business.

CRITICAL RULES:
1. entityName must be the REAL domain object — "Candidate", "Invoice", "Patient", "Order", "Property", "Booking", "Student", "Ticket" — NEVER use "Record"
2. statusValues must be domain-specific (e.g. HR: ["applied","screening","interview","offer","hired","rejected"], Medical: ["scheduled","in_progress","completed","cancelled"], Legal: ["open","in_discovery","hearing","settled","closed"])
3. primaryColor must fit the business domain (medical=#0ea5e9, legal=#7c3aed, food/restaurant=#f97316, finance/accounting=#059669, HR/staffing=#2563eb, retail/ecom=#ec4899, real estate=#d97706, education=#6366f1, logistics=#64748b)
4. entityFields must be the REAL fields for this domain entity — include email, phone, domain-specific fields, notes
5. dashboardStats must be 4 meaningful KPIs for this domain
6. sampleData must be 3 REALISTIC records for this domain with real-looking data (Indian names, real positions, real values)
7. navPages — list pages this specific business needs (not generic "Records")
8. Keep appName under 35 chars, businessName under 35 chars

Return ONLY valid JSON, no markdown, no explanation:
{
  "appName": "HR Consultancy Pro",
  "businessName": "Apex Staffing Pvt Ltd",
  "primaryColor": "#2563eb",
  "secondaryColor": "#7c3aed",
  "accentColor": "#f0f4ff",
  "entityName": "Candidate",
  "entityNamePlural": "Candidates",
  "entityIcon": "👤",
  "statusValues": ["applied", "screening", "interview", "offer", "hired", "rejected"],
  "statusColors": {
    "applied": "#3b82f6",
    "screening": "#f59e0b",
    "interview": "#8b5cf6",
    "offer": "#f97316",
    "hired": "#10b981",
    "rejected": "#ef4444"
  },
  "entityFields": [
    {"name": "email", "label": "Email Address", "type": "email", "required": true, "icon": "📧"},
    {"name": "phone", "label": "Phone Number", "type": "text", "required": false, "icon": "📞"},
    {"name": "position", "label": "Position Applied", "type": "text", "required": true, "icon": "💼"},
    {"name": "experience", "label": "Experience (years)", "type": "number", "required": false, "icon": "📅"},
    {"name": "expected_salary", "label": "Expected Salary", "type": "text", "required": false, "icon": "💰"},
    {"name": "notes", "label": "Notes", "type": "textarea", "required": false, "icon": "📝"}
  ],
  "dashboardStats": [
    {"key": "total", "label": "Total Candidates", "icon": "👥", "color": "#2563eb", "filter": null},
    {"key": "interview", "label": "Interviews Scheduled", "icon": "🗓", "color": "#8b5cf6", "filter": "interview"},
    {"key": "hired", "label": "Placements Done", "icon": "✅", "color": "#10b981", "filter": "hired"},
    {"key": "applied", "label": "New Applications", "icon": "📋", "color": "#f59e0b", "filter": "applied"}
  ],
  "navPages": [
    {"id": "dashboard", "label": "Dashboard", "icon": "🏠", "href": "/"},
    {"id": "reports", "label": "Reports", "icon": "📊", "href": "/reports.html"}
  ],
  "extraPages": [
    {"id": "reports", "title": "Placement Reports", "icon": "📊", "description": "Track placements and revenue"}
  ],
  "userRoles": ["admin", "recruiter"],
  "modules": [],
  "domainTerminology": {
    "createBtn": "Add Candidate",
    "editBtn": "Update Profile",
    "deleteConfirm": "Remove this candidate?",
    "searchPlaceholder": "Search by name, position, email...",
    "emptyState": "No candidates yet. Add your first candidate.",
    "listTitle": "All Candidates"
  },
  "sampleData": [
    {"title": "Priya Sharma", "status": "interview", "email": "priya.sharma@email.com", "phone": "9876543210", "position": "Senior Software Engineer", "experience": "4", "expected_salary": "12 LPA", "notes": "Strong in React and Node.js, good communication"},
    {"title": "Rahul Mehta", "status": "applied", "email": "rahul.mehta@email.com", "phone": "9876543211", "position": "Product Manager", "experience": "6", "expected_salary": "18 LPA", "notes": "MBA IIM-A, 6 years PM experience in fintech"},
    {"title": "Anita Singh", "status": "hired", "email": "anita.singh@email.com", "phone": "9876543212", "position": "Data Analyst", "experience": "2", "expected_salary": "7 LPA", "notes": "Placed at TCS, starts 1st Dec"}
  ]
}`;

  const userMessage = `Produce a complete domain-specific app generation spec from this blueprint:\n${JSON.stringify(blueprint, null, 2).slice(0, 5000)}`;
  return callGroq(apiKey, model, systemPrompt, userMessage, deps);
}

// ─── 5. Modification Analysis ──────────────────────────────────────────────────

async function analyzeModification({ request, currentSpec, currentBlueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = `You are a software change analyst.
Analyse a requested modification to an existing application and return a plan.
Return ONLY valid JSON, no markdown:
{
  "summary": "Brief description of what this change does",
  "affectedModules": ["records"],
  "newModules": ["attendance"],
  "steps": ["Step 1", "Step 2"],
  "estimatedImpact": "Adds X with Y API endpoints and Z new pages",
  "breakingChange": false,
  "newEntityFields": [{"entity": "Entity", "field": "field_name", "type": "text"}]
}`;

  const contextParts = [
    `Modification request: ${request}`,
    currentSpec       && `Current app: entity=${currentSpec.entityName}, modules=${(currentSpec.modules||[]).join(',')}`,
    currentBlueprint  && `Current modules: ${currentBlueprint.coreModules?.map(m => m.name).join(', ') || ''}`,
  ].filter(Boolean).join('\n\n');

  return callGroq(apiKey, model, systemPrompt, contextParts, deps);
}

module.exports = {
  analyze,
  generateBlueprint,
  generateArchitecture,
  generateAppSpec,
  analyzeModification,
  cleanConversation,
  MAX_MESSAGE_LENGTH,
};
