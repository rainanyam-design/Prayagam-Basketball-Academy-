# Prayagam Basketball Academy website

A responsive React + Supabase website with a public academy homepage, coach administration portal and read-only player portal.

## Included features

- Public academy homepage with academy name, address, head coach, phone and training timings.
- Public player directory showing player names and photos only (no DOB, height, phone or private profile details).
- Public daily attendance records, senior-player Hall of Fame, and public photo/video gallery.
- Monthly fee form defaults to ₹600; coaches can change the amount for a particular player/month.
- Separate coach and player experiences after secure sign-in.
- Coach-controlled player directory and player statistics (name, DOB, height, position, jersey number, optional phone/photo URL).
- Daily attendance register (Present / Absent / Late).
- Monthly player fee records (Paid / Pending).
- Tournament calendar / result notes.
- Senior player Hall of Fame.
- Image and video gallery.
- Coach-editable academy details and logo URL.
- Supabase Row Level Security (RLS): players cannot change official records; coaches can manage them.
- Supports two coach accounts and at least 70 player accounts. Accounts are provisioned by the academy, not through open public registration.

## Important setup

This is a real database-backed app. It needs a Supabase project before login and data management will work. The website source is ready, but no live database or hosting account has been created on your behalf.

### 1. Create the database

1. Go to [Supabase](https://supabase.com/) and create a project.
2. Open **SQL Editor → New query**.
3. Paste and run `supabase/schema.sql`.
4. In **Project Settings → API**, copy the Project URL and anon/public key.

### 2. Configure and run the website

Install Node.js (LTS), unzip this project, open a terminal in the project folder and run:

```bash
npm install
```

Copy `.env.example` to a new file named `.env` and fill in your Supabase URL and anon key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Then run:

```bash
npm run dev
```

Open the local URL printed in the terminal (usually http://localhost:5173).

### 3. Create secure accounts

In Supabase, open **Authentication → Users → Add user**. Create two coach accounts and up to 70 player accounts. Use the real email addresses and set temporary passwords; share credentials privately and ask members to change them.

For each player:
1. Add their record in **Table Editor → players** and copy its `id`.
2. Create the matching Auth user in **Authentication → Users** and copy the user's UUID.
3. In SQL Editor, insert their profile (replace the example values):

```sql
insert into public.profiles(user_id, display_name, role, player_id)
values ('AUTH-USER-UUID', 'Player Name', 'player', 'PLAYER-ROW-UUID');
```

For each coach, create the Auth user and insert:

```sql
insert into public.profiles(user_id, display_name, role)
values ('AUTH-USER-UUID', 'Coach Name', 'coach');
```

The database enforces a maximum of two coach profiles and 70 player profiles. Create up to those limits as required. The coach role grants administrative access. Do not give player accounts coach role.

### 4. Enable photo and video uploads

1. In Supabase, go to **Storage → New bucket**.
2. Name it `academy-media`.
3. Set the bucket to **Public** (the site displays public academy photos/videos).
4. Add these Storage policies in SQL Editor:

```sql
create policy "Coach uploads academy media"
on storage.objects for insert to authenticated
with check (bucket_id = 'academy-media' and public.is_coach());

create policy "Coach updates academy media"
on storage.objects for update to authenticated
using (bucket_id = 'academy-media' and public.is_coach())
with check (bucket_id = 'academy-media' and public.is_coach());

create policy "Coach deletes academy media"
on storage.objects for delete to authenticated
using (bucket_id = 'academy-media' and public.is_coach());

create policy "Public reads academy media"
on storage.objects for select to public
using (bucket_id = 'academy-media');
```

## 5. Publish it online (free-tier options)

### Vercel
1. Create a GitHub account and a new repository.
2. Upload the unzipped project files to the repository.
3. Sign in at [Vercel](https://vercel.com/) and choose **Add New → Project**.
4. Import the GitHub repository. Vercel normally detects Vite automatically.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Environment Variables**.
6. Deploy. Vercel will give you a public website URL.
7. After any code update, push to GitHub and Vercel will redeploy automatically.

### Netlify
You can also import the GitHub repository in [Netlify](https://netlify.com/), set build command `npm run build`, publish directory `dist`, and add the same environment variables.

## Operational notes / things to customise

- Replace the logo with your academy logo using the coach portal / settings. The public bucket is intentionally public because gallery media is public.
- Set actual training timings in Academy settings.
- Add player and coach photos using image URLs for profiles / Hall of Fame. The gallery has direct image/video upload.
- This starter includes player, attendance, tournament, fee, Hall of Fame and gallery record creation/deletion, plus editing the academy's public settings. Existing individual records are not yet editable inline; for a production launch, add coach-side edit forms for player, attendance, fee and tournament records before relying on it for day-to-day administration.
- The app currently has a coach-managed roster; a player sees the roster and their own profile, but cannot edit official data.
- Attendance is public on the academy homepage through a restricted view showing only session date, player name and status (not internal player IDs). Fee pages remain private: players see only their own fee records and coaches see all records. The public player directory query requests only player name and photo URL; personal details are not displayed publicly.
- Supabase RLS is the security boundary. Never put a `service_role` key in frontend code.
- Before launch, test with one coach account and one player account and verify the player cannot write to tables.
