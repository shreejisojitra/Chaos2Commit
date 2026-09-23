# AI Solution Builder — Backend

Node.js HTTP server. No Express — pure `http` module for full control.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env → set OPENAI_API_KEY=sk-proj-...

# 3. Start server
node server.js
```

Server starts at: http://127.0.0.1:3847

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Main entry point — all routes |
| `ai-service.js` | OpenAI Chat Completions API |
| `generator.js` | Writes app files from AI spec |
| `db.js` | JSON-based data store |
| `project-store.js` | Builder project persistence |
| `config.json` | Generated app metadata |

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes (for AI features) | — |
| `OPENAI_MODEL` | No | `gpt-4.1-mini` |
| `PORT` | No | `3847` |
| `SESSION_SECRET` | No | dev default |

## Tests

```bash
# With server running:
node scripts/run-tests.js
```
