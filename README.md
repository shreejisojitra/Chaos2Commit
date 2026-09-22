# AI Solution Builder

Complete project codebase for **AI Solution Builder** — SaaS UI + generated application runtime.

## Structure

| Path | Description |
|------|-------------|
| `index.html` | Marketing landing page |
| `dashboard.html` | User dashboard (projects, credits, plans) |
| `project.html` | Project workspace (input → consultant → blueprint → app) |
| `admin.html` | Admin dashboard |
| `generated-app/` | Runnable Node.js application (auth, records, attendance module) |

## Run the product UI

Open the HTML files in a browser (or serve the folder):

```bash
npx --yes serve .
# then open the printed URL (index.html / dashboard.html)
```

Data is stored in browser `localStorage` (`asb_projects`, `asb_billing`).

## Run the generated application

```bash
cd generated-app
node server.js
```

Open http://127.0.0.1:3847

Demo login: `admin@example.com` / `admin123`

## Notes

- No `.env` secrets are included.
- Session secret in `generated-app/server.js` is a demo default — change for production.
