# Deploying to Vercel with Supabase (PostgreSQL)

This app is configured to use **PostgreSQL** via Supabase so it can run on Vercel (SQLite isn’t supported on serverless).

## 1. Supabase setup

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Create a new project and wait for the database to be ready.
3. In the dashboard: **Project Settings → Database**.
4. Copy the **Connection string** (URI format). You can use either:
   - **Pooled (Transaction mode)** – port **6543** – recommended for Vercel so serverless doesn’t exhaust connections.
   - **Direct** – port **5432** – use this when running `prisma migrate` locally if the pooled URL gives issues.

Replace `[YOUR-PASSWORD]` in the URL with your database password.

## 2. Environment variables

**Local (e.g. `.env`):**

```env
DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

For running migrations, the same URL is used (from `prisma.config.ts`). If you use the **direct** URL locally, migrations use it too.

**Vercel (Project → Settings → Environment Variables):**

- `DATABASE_URL` = your Supabase connection string. Prefer the **pooled** one (port **6543**, Transaction mode) for production.

## 3. Create the database schema

With `DATABASE_URL` set in `.env`:

```bash
npx prisma migrate dev --name init_postgres
```

Or, to sync the schema without creating a migration file:

```bash
npx prisma db push
```

## 4. Deploy to Vercel

1. Push your code to GitHub (or connect another Git provider).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo.
3. Add `DATABASE_URL` in the project’s Environment Variables (use the pooled Supabase URL for production).
4. Deploy. Vercel runs `next build`; ensure `prisma generate` runs (it’s part of the build if your build runs `next build` and Prisma is configured to generate before that, or add a `postinstall` script that runs `prisma generate` if needed).

## 5. Run migrations in production (optional)

To apply migrations against the production DB, run locally with `DATABASE_URL` pointing at your production Supabase instance:

```bash
npx prisma migrate deploy
```

You can also run this in Vercel’s build (e.g. a script that runs `prisma migrate deploy` then `next build`) if you want migrations to run on each deploy.

---

**Summary:** Prisma uses PostgreSQL via `DATABASE_URL`. Use the pooled Supabase URL on Vercel. Run `prisma migrate dev` or `prisma db push` once to create tables, then deploy.
