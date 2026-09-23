/**
 * AI Service — Groq API (Free tier, OpenAI-compatible)
 * Model: openai/gpt-oss-20b
 * Free at: https://console.groq.com
 */

const DEFAULT_MODEL = 'openai/gpt-oss-120b'; // more reliable for structured JSON
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TURNS = 20;

// ─── Key helper ────────────────────────────────────────────────────────────────

function getApiKey(deps = {}) {
  const key = deps.apiKey === undefined ? process.env.GROQ_API_KEY : deps.apiKey;
  if (!key || key === 'your-groq-api-key-here') {
    const err = new Error(
      'Groq API key not set. Add GROQ_API_KEY to backend/.env and restart. Free key at https://console.groq.com'
    );
    err.status = 503;
    throw err;
  }
  return key;
}

function getModel(deps = {}) {
  return deps.model || process.env.GROQ_MODEL || DEFAULT_MODEL;
}

// ─── Core call (Groq = OpenAI-compatible) ─────────────────────────────────────

async function callGroq(apiKey, model, systemPrompt, userMessage, deps = {}, retries = 2) {
  const fetchImpl = deps.fetch || global.fetch;

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (_) {
      if (attempt < retries) continue;
      const err = new Error('Could not reach Groq. Check your internet connection.');
      err.status = 502;
      throw err;
    }

    if (!response.ok) {
      let errMsg = `Groq error (${response.status}).`;
      try { const b = await response.json(); if (b.error?.message) errMsg = b.error.message; } catch (_) {}
      if (attempt < retries) { await new Promise(r => setTimeout(r, 1000)); continue; }
      const err = new Error(errMsg);
      err.status = 502;
      throw err;
    }

    let payload;
    try { payload = await response.json(); } catch (_) {
      if (attempt < retries) continue;
      const err = new Error('Groq returned an unreadable response.');
      err.status = 502;
      throw err;
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 800)); continue; }
      const err = new Error('Groq returned an empty response.');
      err.status = 502;
      throw err;
    }

    // Strip markdown fences if present
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Find first { and last } to extract JSON even if there's preamble text
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 800)); continue; }
      const err = new Error('AI response was not valid JSON. Try again.');
      err.status = 502;
      throw err;
    }

    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 800)); continue; }
      const err = new Error('AI response was not valid JSON. Try again.');
      err.status = 502;
      throw err;
    }
  }
}

// ─── Conversation cleaner ──────────────────────────────────────────────────────

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
You MUST return ONLY a valid JSON object — no markdown, no explanation, just JSON.
Return this exact structure:
{
  "businessUnderstanding": "2-3 sentence summary of what this business does",
  "targetUsers": ["User type 1", "User type 2"],
  "explicitRequirements": [
    {"text": "requirement description", "evidence": "quote from user or Not provided by user", "confidence": 0.9}
  ],
  "missingRequirements": ["Missing thing 1", "Missing thing 2"],
  "questions": ["Question 1?", "Question 2?"],
  "recommendations": [
    {"text": "recommendation", "explanation": "why this helps", "confidence": 0.8}
  ],
  "assumptions": ["Assumption 1", "Assumption 2"]
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
Produce a detailed product blueprint based on the business requirements given.
You MUST return ONLY a valid JSON object — no markdown, no explanation, just JSON.
Return this exact structure:
{
  "productName": "short product name",
  "productDescription": "2-3 sentence description",
  "targetUsers": ["User type 1"],
  "coreModules": [
    {"id": "auth", "name": "Authentication", "description": "User login and registration", "priority": "must-have"}
  ],
  "dataEntities": [
    {"name": "User", "fields": ["id", "email", "name", "role", "created_at"]}
  ],
  "userRoles": ["admin", "user"],
  "keyFlows": ["User registers and logs in", "Admin manages records"],
  "nonFunctionalRequirements": ["Responsive UI", "Secure password storage"],
  "techStack": {"backend": "Node.js", "frontend": "HTML/CSS/JS", "database": "JSON file store", "deployment": "Render"}
}`;

  return callGroq(apiKey, model, systemPrompt, `Generate blueprint for:\n\n${contextParts}`, deps);
}

// ─── 3. Architecture ───────────────────────────────────────────────────────────

async function generateArchitecture({ blueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = `You are a senior software architect.
Produce a system architecture spec.
IMPORTANT for diagrams:
- systemDiagram: Mermaid flowchart LR code. NO backtick fences. NO quotes around node labels. Use simple alphanumeric IDs. Example: flowchart LR\n  Client[Browser] --> API[Node API]\n  API --> Auth[Auth Module]\n  API --> DB[(JSON Store)]
- erDiagram: Mermaid erDiagram code. NO backtick fences. Use simple entity names and field types. Example: erDiagram\n  USER ||--o{ RECORD : creates\n  USER {\n    string id\n    string email\n  }
- Use \\n for newlines inside the JSON string value (not actual newlines).
Return ONLY this JSON structure, no extra text, no markdown:
{
  "systemDiagram": "flowchart LR\\n  Client[Browser] --> API[Node API]\\n  API --> DB[(Store)]",
  "erDiagram": "erDiagram\\n  USER ||--o{ RECORD : creates\\n  USER {\\n    string id\\n    string email\\n  }",
  "apiEndpoints": [
    {"method": "POST", "path": "/api/auth/login", "description": "User login", "auth": false},
    {"method": "GET", "path": "/api/records", "description": "List records", "auth": true}
  ],
  "sitemap": ["Login", "Dashboard", "Records"],
  "securityNotes": ["Passwords hashed with scrypt", "Session-based auth with HttpOnly cookies"]
}`;

  const userMessage = `Generate architecture for:
Product: ${blueprint.productName}
Modules: ${blueprint.coreModules.map(m => m.name).join(', ')}
Entities: ${blueprint.dataEntities.map(e => e.name).join(', ')}
Roles: ${blueprint.userRoles.join(', ')}
Stack: ${blueprint.techStack.backend} / ${blueprint.techStack.frontend} / ${blueprint.techStack.database}`;

  return callGroq(apiKey, model, systemPrompt, userMessage, deps);
}

// ─── 4. App Generation Spec ────────────────────────────────────────────────────

async function generateAppSpec({ blueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = `You are a code generation engine.
Given a product blueprint, produce the app generation spec.
entityName: singular primary entity name (e.g. "Candidate", "Invoice", "Order", "Record").
entityFields: all fields for the primary entity EXCLUDING id, owner_id, created_at, updated_at.
modules: extra module IDs (e.g. ["attendance"]). Use empty array [] if none needed.
Keep appName and businessName under 40 characters each.
You MUST return ONLY a valid JSON object — no markdown, no explanation, just JSON.
Return this exact structure:
{
  "appName": "HR Manager",
  "businessName": "Apex HR Solutions",
  "entityName": "Candidate",
  "entityNamePlural": "Candidates",
  "entityFields": [
    {"name": "phone", "type": "text", "required": false},
    {"name": "position", "type": "text", "required": true}
  ],
  "modules": [],
  "userRoles": ["admin", "user"],
  "pages": ["index.html", "login.html", "register.html"]
}`;

  const userMessage = `Produce app spec from this blueprint:\n${JSON.stringify(blueprint, null, 2).slice(0, 4000)}`;
  return callGroq(apiKey, model, systemPrompt, userMessage, deps);
}

// ─── 5. Modification Analysis ──────────────────────────────────────────────────

async function analyzeModification({ request, currentSpec, currentBlueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = `You are a software change analyst.
Analyse a requested modification to an existing application and return a plan.
You MUST return ONLY a valid JSON object — no markdown, no explanation, just JSON.
Return this exact structure:
{
  "summary": "Brief description of what this change does",
  "affectedModules": ["records"],
  "newModules": ["attendance"],
  "steps": ["Step 1", "Step 2", "Step 3"],
  "estimatedImpact": "Adds attendance tracking with 3 API endpoints and 1 new page",
  "breakingChange": false,
  "newEntityFields": [
    {"entity": "Employee", "field": "department", "type": "text"}
  ]
}`;

  const contextParts = [
    `Modification request: ${request}`,
    currentSpec       && `Current app: entity=${currentSpec.entityName}, modules=${(currentSpec.modules||[]).join(',')}`,
    currentBlueprint  && `Current modules: ${currentBlueprint.coreModules?.map(m => m.name).join(', ') || '—'}`,
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
