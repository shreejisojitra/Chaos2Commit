/**
 * AI Service — all OpenAI calls go through here.
 * Uses Chat Completions API (/v1/chat/completions) — works with all OpenAI accounts.
 * Model: gpt-4.1-mini by default (cheap + fast).
 */

const DEFAULT_MODEL = 'gpt-4.1-mini';
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TURNS = 20;

// ─── Shared helpers ────────────────────────────────────────────────────────────

function getApiKey(deps = {}) {
  const key = deps.apiKey === undefined ? process.env.OPENAI_API_KEY : deps.apiKey;
  if (!key || key === 'your-openai-api-key-here') {
    const err = new Error(
      'OpenAI API key not configured. Add OPENAI_API_KEY to generated-app/.env and restart the server.',
    );
    err.status = 503;
    throw err;
  }
  return key;
}

function getModel(deps = {}) {
  return deps.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/**
 * Core function — calls /v1/chat/completions with a JSON schema response_format.
 * When schema is provided, returns parsed JSON object.
 * When schema is null, returns the raw string content.
 */
async function callChatCompletions(apiKey, model, systemPrompt, userMessage, schema, deps = {}) {
  const fetchImpl = deps.fetch || global.fetch;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userMessage },
  ];

  const requestBody = {
    model,
    messages,
    max_tokens: schema ? 2000 : 1400,
    temperature: 0.4,
  };

  // Use JSON schema structured output if a schema is provided
  if (schema) {
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: schema.name,
        strict: true,
        schema: schema.schema,
      },
    };
  }

  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (_) {
    const err = new Error('Could not reach OpenAI. Check your internet connection and try again.');
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    let errMsg = 'OpenAI returned an error. Please try again.';
    try {
      const errBody = await response.json();
      if (errBody.error?.message) errMsg = errBody.error.message;
    } catch (_) {}
    const err = new Error(errMsg);
    err.status = response.status === 401 ? 401 : 502;
    throw err;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    const err = new Error('OpenAI returned an unreadable response.');
    err.status = 502;
    throw err;
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error('OpenAI returned an empty response.');
    err.status = 502;
    throw err;
  }

  if (schema) {
    try {
      return JSON.parse(content);
    } catch (_) {
      const err = new Error('OpenAI response was not valid JSON. Try again.');
      err.status = 502;
      throw err;
    }
  }

  return content;
}

// ─── Schemas ───────────────────────────────────────────────────────────────────

const CONSULTANT_SCHEMA = {
  name: 'business_consultant_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      businessUnderstanding:  { type: 'string' },
      targetUsers:            { type: 'array', items: { type: 'string' } },
      explicitRequirements: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            text:       { type: 'string' },
            evidence:   { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['text', 'evidence', 'confidence'],
        },
      },
      missingRequirements:  { type: 'array', items: { type: 'string' } },
      questions:            { type: 'array', items: { type: 'string' } },
      recommendations: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            text:        { type: 'string' },
            explanation: { type: 'string' },
            confidence:  { type: 'number' },
          },
          required: ['text', 'explanation', 'confidence'],
        },
      },
      assumptions: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'businessUnderstanding', 'targetUsers', 'explicitRequirements',
      'missingRequirements', 'questions', 'recommendations', 'assumptions',
    ],
  },
};

const BLUEPRINT_SCHEMA = {
  name: 'product_blueprint',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      productName:        { type: 'string' },
      productDescription: { type: 'string' },
      targetUsers:        { type: 'array', items: { type: 'string' } },
      coreModules: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id:          { type: 'string' },
            name:        { type: 'string' },
            description: { type: 'string' },
            priority:    { type: 'string' },
          },
          required: ['id', 'name', 'description', 'priority'],
        },
      },
      dataEntities: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            name:   { type: 'string' },
            fields: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'fields'],
        },
      },
      userRoles:                  { type: 'array', items: { type: 'string' } },
      keyFlows:                   { type: 'array', items: { type: 'string' } },
      nonFunctionalRequirements:  { type: 'array', items: { type: 'string' } },
      techStack: {
        type: 'object', additionalProperties: false,
        properties: {
          backend:    { type: 'string' },
          frontend:   { type: 'string' },
          database:   { type: 'string' },
          deployment: { type: 'string' },
        },
        required: ['backend', 'frontend', 'database', 'deployment'],
      },
    },
    required: [
      'productName', 'productDescription', 'targetUsers', 'coreModules',
      'dataEntities', 'userRoles', 'keyFlows', 'nonFunctionalRequirements', 'techStack',
    ],
  },
};

const ARCHITECTURE_SCHEMA = {
  name: 'system_architecture',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      systemDiagram:  { type: 'string' },
      erDiagram:      { type: 'string' },
      apiEndpoints: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            method:      { type: 'string' },
            path:        { type: 'string' },
            description: { type: 'string' },
            auth:        { type: 'boolean' },
          },
          required: ['method', 'path', 'description', 'auth'],
        },
      },
      sitemap:       { type: 'array', items: { type: 'string' } },
      securityNotes: { type: 'array', items: { type: 'string' } },
    },
    required: ['systemDiagram', 'erDiagram', 'apiEndpoints', 'sitemap', 'securityNotes'],
  },
};

const GENERATE_SCHEMA = {
  name: 'app_generation_spec',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      appName:          { type: 'string' },
      businessName:     { type: 'string' },
      entityName:       { type: 'string' },
      entityNamePlural: { type: 'string' },
      entityFields: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            name:     { type: 'string' },
            type:     { type: 'string' },
            required: { type: 'boolean' },
          },
          required: ['name', 'type', 'required'],
        },
      },
      modules:   { type: 'array', items: { type: 'string' } },
      userRoles: { type: 'array', items: { type: 'string' } },
      pages:     { type: 'array', items: { type: 'string' } },
    },
    required: [
      'appName', 'businessName', 'entityName', 'entityNamePlural',
      'entityFields', 'modules', 'userRoles', 'pages',
    ],
  },
};

const MODIFY_SCHEMA = {
  name: 'modification_plan',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      summary:         { type: 'string' },
      affectedModules: { type: 'array', items: { type: 'string' } },
      newModules:      { type: 'array', items: { type: 'string' } },
      steps:           { type: 'array', items: { type: 'string' } },
      estimatedImpact: { type: 'string' },
      breakingChange:  { type: 'boolean' },
      newEntityFields: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            entity: { type: 'string' },
            field:  { type: 'string' },
            type:   { type: 'string' },
          },
          required: ['entity', 'field', 'type'],
        },
      },
    },
    required: [
      'summary', 'affectedModules', 'newModules', 'steps',
      'estimatedImpact', 'breakingChange', 'newEntityFields',
    ],
  },
};

// ─── Consultant ────────────────────────────────────────────────────────────────

function cleanConversation(conversation) {
  if (!Array.isArray(conversation)) return [];
  return conversation.slice(-MAX_TURNS).flatMap((item) => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') return [];
    return [{ role: item.role, content: item.content.slice(0, MAX_MESSAGE_LENGTH) }];
  });
}

async function analyze({ message, conversation = [], projectContext = {} }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const contextParts = [
    projectContext.idea         && `Business idea: ${projectContext.idea.slice(0, 5000)}`,
    projectContext.requirements && `Requirements: ${projectContext.requirements.slice(0, 5000)}`,
    projectContext.process      && `Existing process: ${projectContext.process.slice(0, 5000)}`,
    projectContext.docText      && `Document text: ${projectContext.docText.slice(0, 12000)}`,
  ].filter(Boolean).join('\n\n');

  const systemPrompt = [
    'You are a concise business and software requirements consultant.',
    'Analyse the user\'s business idea and return a structured analysis.',
    'Use evidence only from what the user provided. When evidence is absent, use exactly "Not provided by user".',
    'Keep confidence values between 0 and 1. Identify missing requirements and ask relevant follow-up questions.',
    'Return only the JSON object — no extra text.',
    contextParts ? `\nProject context:\n${contextParts}` : '',
  ].filter(Boolean).join('\n');

  // Build conversation history as the user message
  const history = cleanConversation(conversation);
  const historyText = history.length
    ? history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\n\n'
    : '';
  const userMessage = `${historyText}User: ${message.slice(0, MAX_MESSAGE_LENGTH)}\n\nAnalyse the business described above and return the structured JSON.`;

  return callChatCompletions(apiKey, model, systemPrompt, userMessage, CONSULTANT_SCHEMA, deps);
}

// ─── Blueprint ─────────────────────────────────────────────────────────────────

async function generateBlueprint({ projectContext, consultantAnalysis }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = [
    'You are a senior software architect.',
    'Given business requirements and analysis, produce a detailed product blueprint.',
    'The blueprint must be realistic and actionable. Prefer Node.js + JSON for backend, plain HTML/JS for frontend.',
    'coreModules must reflect the actual business domain.',
    'dataEntities must list the real data the app will store.',
    'Return only the JSON object — no extra text.',
  ].join('\n');

  const contextParts = [
    consultantAnalysis?.businessUnderstanding && `Business understanding: ${consultantAnalysis.businessUnderstanding}`,
    consultantAnalysis?.explicitRequirements?.length &&
      `Confirmed requirements:\n${consultantAnalysis.explicitRequirements.map(r => `- ${r.text}`).join('\n')}`,
    consultantAnalysis?.recommendations?.length &&
      `Recommendations:\n${consultantAnalysis.recommendations.map(r => `- ${r.text}`).join('\n')}`,
    projectContext?.idea         && `Original idea: ${projectContext.idea}`,
    projectContext?.requirements && `User requirements: ${projectContext.requirements}`,
  ].filter(Boolean).join('\n\n');

  const userMessage = `Generate a complete product blueprint for this business:\n\n${contextParts}`;

  return callChatCompletions(apiKey, model, systemPrompt, userMessage, BLUEPRINT_SCHEMA, deps);
}

// ─── Architecture ──────────────────────────────────────────────────────────────

async function generateArchitecture({ blueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = [
    'You are a senior software architect.',
    'Produce a system architecture spec for the given product blueprint.',
    'systemDiagram: valid Mermaid flowchart LR string (no triple-backtick fences, just the diagram code).',
    'erDiagram: valid Mermaid erDiagram string showing entities and relationships.',
    'apiEndpoints: cover all CRUD and auth endpoints needed.',
    'sitemap: list all UI pages.',
    'securityNotes: include auth method, ownership rules, input validation.',
    'Return only the JSON object — no extra text.',
  ].join('\n');

  const userMessage = `Generate system architecture for:\nProduct: ${blueprint.productName}\nModules: ${blueprint.coreModules.map(m => m.name).join(', ')}\nEntities: ${blueprint.dataEntities.map(e => e.name).join(', ')}\nRoles: ${blueprint.userRoles.join(', ')}\nStack: ${blueprint.techStack.backend} / ${blueprint.techStack.frontend} / ${blueprint.techStack.database}`;

  return callChatCompletions(apiKey, model, systemPrompt, userMessage, ARCHITECTURE_SCHEMA, deps);
}

// ─── App Generation Spec ───────────────────────────────────────────────────────

async function generateAppSpec({ blueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = [
    'You are a code generation engine.',
    'Given a product blueprint, produce the exact spec needed to generate a Node.js application.',
    'entityName: singular primary data entity (e.g. "Candidate", "Invoice", "Order").',
    'entityFields: all fields for the primary entity excluding id, owner_id, created_at, updated_at.',
    'modules: string IDs of incremental feature modules beyond core auth+records (e.g. ["attendance"]).',
    'pages: HTML page filenames the UI needs.',
    'Keep appName and businessName under 40 chars each.',
    'Return only the JSON object — no extra text.',
  ].join('\n');

  const userMessage = `Produce app generation spec from this blueprint:\n${JSON.stringify(blueprint, null, 2).slice(0, 6000)}`;

  return callChatCompletions(apiKey, model, systemPrompt, userMessage, GENERATE_SCHEMA, deps);
}

// ─── Modification Analysis ─────────────────────────────────────────────────────

async function analyzeModification({ request, currentSpec, currentBlueprint }, deps = {}) {
  const apiKey = getApiKey(deps);
  const model  = getModel(deps);

  const systemPrompt = [
    'You are a software change analyst.',
    'Analyse a requested modification to an existing application.',
    'Identify which existing modules are affected, what new modules are needed, and the implementation steps.',
    'newEntityFields: fields to add to existing data entities.',
    'estimatedImpact: describe scope (e.g. "Adds attendance CRUD with 3 API endpoints and 1 UI page").',
    'breakingChange: true only if existing data or auth is changed in a breaking way.',
    'Return only the JSON object — no extra text.',
  ].join('\n');

  const contextParts = [
    `Modification request: ${request}`,
    currentSpec    && `Current app spec: ${JSON.stringify(currentSpec).slice(0, 3000)}`,
    currentBlueprint && `Current modules: ${currentBlueprint.coreModules?.map(m => m.name).join(', ') || '—'}`,
  ].filter(Boolean).join('\n\n');

  return callChatCompletions(apiKey, model, systemPrompt, contextParts, MODIFY_SCHEMA, deps);
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
