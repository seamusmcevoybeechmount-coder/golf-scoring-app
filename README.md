# Golf Scoring App (Next.js + Supabase)

## Quick start

1. Create project folder and extract this archive.
2. Install deps:
   ```bash
   npm install
   ```
3. Create `.env.local` and fill in your Supabase values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
   SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```
5. Navigate to http://localhost:3000

## Pages
- `/courses` – select course
- `/players` – enter players (after selecting a course)
- `/score` – hole-by-hole scoring
- `/leaderboard` – mobile-friendly leaderboard
- `/leaderboard-tv` – large TV leaderboard

## Notes
- API routes use database RPCs (`create_competition`, `add_player`, `upsert_score`).
- Ensure you ran the SQL schema in Supabase before using the app.
"# golf-scoring-app" 
