# Backend (Node.js + PostgreSQL)

This is an Express-based backend using PostgreSQL (no MongoDB).

## Quick start

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Choose your Postgres:
   - Local Docker: `docker compose up -d`
   - Neon (hosted): see steps below
3. Run migrations:
   - `npm run migrate`
4. Start the server:
   - Development: `npm run dev`
   - Production: `npm start`

## API

- `GET /health` – returns server status and DB connectivity
- `GET /api/users` – list users
- `POST /api/users` – create user `{ name, email }`
- `PUT /api/users/:id` – update user
- `DELETE /api/users/:id` – delete user

## Environment variables

- `PORT` – server port
- Use ONE of the following:
  - `DATABASE_URL` – full connection string (recommended for Neon)
  - Or `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` – individual settings
  - Optional: `PGSSL=true` for managed Postgres that require TLS

## Notes

- Migrations run all `.sql` files under `migrations/` in order.
- Default Docker credentials align with `.env.example`.

## Using Neon (Hosted PostgreSQL)

1. Create a project/database at https://neon.tech and open your database dashboard.
2. Copy the connection string (e.g. `postgresql://<user>:<pass>@<host>/<db>?sslmode=require`).
3. In `backend/.env`, set:
   ```
   DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
   ```
   Leave `PGHOST`/`PGPORT`/etc. unset.
4. Run `npm run migrate` to create the `users` table on Neon.
5. Start the API with `npm run dev`.# nsabackend
