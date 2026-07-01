# AGAM Cloud Sync Setup (Supabase)

## Step 1 — Create a free Supabase project

1. Go to [https://supabase.com](https://supabase.com) → **New project**
2. Choose a name (e.g. `agam-sync`) and a strong database password
3. Wait ~2 minutes for the project to spin up

## Step 2 — Run this SQL in Supabase

Open **SQL Editor** in your Supabase dashboard and run:

```sql
-- Create the sync table
create table if not exists agam_sync (
  collection  text primary key,
  payload     jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

-- Enable Row Level Security
alter table agam_sync enable row level security;

-- Allow read and write with the anon key
-- (anyone with the URL + key can access — keep the key private)
create policy "Allow anon access" on agam_sync
  for all
  using (true)
  with check (true);
```

## Step 3 — Get your credentials

In Supabase: **Project Settings → API**

| Setting | Where to find it |
|---|---|
| Project URL | `https://xxxxxxxxxxxx.supabase.co` |
| anon / public key | Long `eyJ…` string under "Project API keys" |

## Step 4 — Add credentials to config.js

Open `config.js` in the AGAM folder and fill in:

```js
window.SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
window.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIs...";
```

## Step 5 — Deploy to GitHub Pages

```bash
git add config.js
git commit -m "chore: enable cloud sync"
git push
```

GitHub Pages will pick up the change within ~1 minute.

---

## How sync works

- **On load**: app fetches all data from Supabase and replaces local data
- **On every save**: changed data is pushed to Supabase automatically
- **Offline**: app still works from localStorage; syncs when back online
- **Users/passwords** are never synced to cloud (stored locally only)

## Resetting cloud data

To wipe all cloud data and push fresh local data:

```sql
delete from agam_sync;
```

Then reload the app — it will push your current local data up.
