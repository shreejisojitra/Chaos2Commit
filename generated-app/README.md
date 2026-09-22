# Generated Application

Real full-stack application produced by **AI Solution Builder**.

## What is included

| Layer | Implementation |
|-------|----------------|
| Frontend | Login, register, dashboard, search/filter, create/edit/delete records |
| Backend | Node.js native HTTP server (no framework required) |
| Database | Durable JSON file store (`data/store.json`) |
| APIs | REST `/api/auth/*`, `/api/records/*`, `/api/health`, `/api/config` |
| Authentication | HTTP-only session cookies + scrypt password hashes |
| Business logic | Record ownership, admin vs user permissions, status workflow |

## Run

```bash
cd generated-app
node server.js
```

Open http://127.0.0.1:3847

### Demo accounts

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | admin |
| user@example.com | user123 | user |

## Verified behavior

- Unauthenticated `/` redirects to login
- Login establishes a session
- Create / list / update / delete records
- Users can only edit/delete their own records; admins can manage all

`config.json` is filled by the Application Generator from your project blueprint (name, business, entity labels).
