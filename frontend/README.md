# AI Solution Builder — Frontend

Pure HTML/CSS/JS — no build step required.
Served by the backend at `http://127.0.0.1:3847/builder/<page>.html`

## Pages

| File | URL | Description |
|------|-----|-------------|
| `index.html` | `/builder/index.html` | Landing page |
| `dashboard.html` | `/builder/dashboard.html` | Projects + credits |
| `project.html` | `/builder/project.html?id=<id>` | Full pipeline workspace |
| `admin.html` | `/builder/admin.html` | Admin panel |

## Tech

- Tailwind CSS (CDN)
- Mermaid.js (diagrams)
- PDF.js + Mammoth.js (document upload)
- Vanilla JS (no framework)

## API

All API calls go to the same origin (backend).
`const API = ''` in project.html means all `/api/*` calls hit the backend.

To develop with a separate backend, change `API_BASE` in `config.js`.
