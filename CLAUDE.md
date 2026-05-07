# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # install dependencies (first time)
npm run dev      # start dev server at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the production build locally
```

There are no tests or linting configured.

## Environment

Copy `.env.example` to `.env` and fill in the two required variables:

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Both are exposed to the browser (Vite `VITE_` prefix). The app throws at startup if either is missing (`src/supabase.js`).

## Architecture

This is a **single-page React app** (no router) backed by **Supabase** (auth + PostgreSQL + object storage).

**All application code lives in three files:**

| File | Role |
|------|------|
| `src/supabase.js` | Creates and exports the single Supabase client |
| `src/App.jsx` | Entire app — all views, components, and logic |
| `src/main.jsx` | React DOM mount point |

### View state machine

`App` controls which view is visible via a `view` string state (`'gallery'` | `'detail'` | `'form'` | `'admin'` | `'password-reset'`). There is no URL routing — the active view is driven purely by state.

### Components in `App.jsx`

- **`App`** — root: holds session/profile/tomatoes state, auth listener, data loading, filtering
- **`AuthPage`** — login / register / password-reset-request (shown when unauthenticated)
- **`PasswordResetView`** — new-password form (shown after user clicks email reset link with `?reset=true`)
- **`GalleryView`** + **`TomatoCard`** — filterable grid of tomato variety cards
- **`DetailView`** — full detail page with inline edit/delete (edit/delete allowed for own entries or admins)
- **`FormView`** — create / edit form with image upload
- **`AdminView`** — user management (admin only): lists all profiles, toggles roles, confirms unverified accounts

### Supabase database schema

**`profiles`** — extends `auth.users`; columns: `id`, `email`, `name`, `role` (`'admin'`|`'user'`), `created_at`. A trigger (`handle_new_user`) auto-creates a profile on signup.

**`tomatoes`** — variety records with text fields, integer ratings (1–5), `tags TEXT[]`, and `image_url`. Owners and admins can update/delete; all authenticated users can read and insert their own.

Row Level Security is enabled on both tables. Admin checks are done inside RLS policies by looking up `profiles.role`.

### Supabase storage

Images are uploaded to the **`tomato-images`** bucket (public) under the path `{user_id}/{timestamp}.{ext}`. Upload happens inside `saveTomato()` in `App.jsx` before the database insert/update.

### Supabase RPC functions (defined in `supabase-setup.sql`)

- `get_users_confirmed_status()` — returns confirmation status for all auth users (used by `AdminView`)
- `confirm_user_by_id(target_user_id)` — manually confirms a user's email (used by `AdminView`)

These must exist in Supabase for the admin panel to function.

### Roles

The first admin must be set manually in the Supabase Table Editor (`profiles.role = 'admin'`). Admins can then promote/demote others through the in-app admin panel.

## Deployment

The app is deployed on **Vercel**. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel project settings. Pushes to `main` trigger automatic deployments.
