# AI Solution Builder

Turn your business idea into a working software solution.

## Project Structure

```
Chaos2Commit/
├── frontend/          ← Builder UI (HTML pages served by backend)
│   ├── index.html        Landing page
│   ├── dashboard.html    Project dashboard
│   ├── project.html      Project workspace (full pipeline)
│   └── admin.html        Admin panel
│
├── backend/           ← Node.js API server
│   ├── server.js         Main server (all API routes)
│   ├── ai-service.js     OpenAI integration (Chat Completions API)
│   ├── generator.js      App file generator
│   ├── db.js             JSON file-based database
│   ├── project-store.js  Builder project persistence
│   ├── config.json       Generated app config
│   ├── .env              Environment variables (git-ignored)
│   ├── .env.example      Example env file
│   ├── data/             Runtime data (store.json, projects.json, changelog.json)
│   ├── modules/          Incremental feature modules (attendance, etc.)
│   ├── public/           Generated app UI (served at /)
│   ├── scripts/          Utility scripts (run-tests, apply-change)
│   └── routes/           Express route files (legacy)
│
└── generated-app/     ← Legacy reference (can be deleted)
```

## Quick Start

### 1. Configure API key

```
backend/.env  →  OPENAI_API_KEY=sk-proj-...
```

### 2. Start the server

```bash
cd backend
node server.js
```

Or from root:
```bash
npm start
```

### 3. Open the builder

```
http://127.0.0.1:3847/builder/dashboard.html
```

### 4. Open the generated app

```
http://127.0.0.1:3847/
```
Demo: `admin@example.com` / `admin123`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET  /api/health` | Server health + AI status |
| `POST /api/ai/chat` | AI consultant chat |
| `POST /api/ai/blueprint` | Generate product blueprint |
| `POST /api/ai/architecture` | Generate system architecture |
| `POST /api/ai/generate` | Generate application files |
| `POST /api/ai/modify` | Analyse a modification |
| `POST /api/ai/modify/apply` | Apply a modification |
| `POST /api/deploy` | Register deployment |
| `GET  /api/versions` | Changelog |
| `GET/PUT/DELETE /api/projects/:id` | Project CRUD |
| `POST /api/auth/login` | Login |
| `POST /api/auth/register` | Register |
| `GET  /api/records` | Records CRUD |
| `GET  /api/attendance` | Attendance CRUD |

## Credit Costs

| Action | Credits |
|--------|---------|
| Consultant chat | 5 |
| Blueprint | 8 |
| Architecture | 8 |
| Generate app | 25 |
| Modify | 15 |
| Document upload | 3 |
