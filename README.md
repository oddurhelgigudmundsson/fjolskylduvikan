# Fjölskylduvikan

The family's home-screen app: shared shopping list, weekly menu, and (coming next) calendars, chores and notifications.

It is a plain static web app: no build step. It is hosted on **GitHub Pages**, and the data lives in **Supabase**.

```
index.html             app shell
styles.css             all styling (light + dark mode)
js/config.js           the families: each one's Supabase URL + publishable key  ← the only file you edit to connect
js/family.js           picks which family this phone belongs to (?f=code, saved code, or asks)
js/app.js              screens: profiles/PIN, home, shopping list, menu
js/data.js             data layer (Supabase, or demo mode when config is empty)
js/util.js             Icelandic dates, auto-categorising shopping items
sw.js                  service worker (fast start, works on weak signal)
manifest.webmanifest   home-screen app settings
supabase/schema.sql    database tables, security rules, the 5 profiles
supabase/ny-fjolskylda.sql  the whole database for a NEW family in one file (generated)
tools/build_setup_sql.py    regenerates ny-fjolskylda.sql from the other .sql files
```

## One-time setup

### 1. Database (Supabase)
1. Supabase → **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
2. **Authentication → Users → Add user → Create new user**: one shared family email and password, with **Auto Confirm User** ticked. Everyone logs in with this once per phone.
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up", so nobody else can create an account.
4. Put the **Project URL** and **anon / publishable key** into `FAMILIES` in `js/config.js`.

### 2. Hosting (GitHub Pages)
Repo **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, branch **main**, folder **/ (root)** → Save.
After a minute the app is live at `https://<username>.github.io/<repo>/`.

### 3. On each iPhone
1. Open the link in **Safari** (not Chrome).
2. Share button → **Add to Home Screen** → Add.
3. Open the app **from the home screen**, log in with the family account, and pick your profile and PIN.

> The home-screen app has its own storage, separate from Safari. Log in inside the installed app, not in Safari.

## How it works
- **Profiles:** Oddur and Kristín are parents; Alma Rún, Thelma Lind and Pétur Ingi are kids. Each person picks a 4-digit PIN the first time. Parents can reset a forgotten PIN from the profile menu (tap your avatar).
- **Shopping list:** anyone can add items (comma-separated works: `mjólk, egg, brauð`). Items are sorted into store sections automatically and update live on every phone.
- **Menu:** parents plan dinner per day; "Vista + setja á listann" saves the meal and adds its ingredients to the shopping list, skipping anything already on it.

## Demo mode
With `js/config.js` empty, the app runs entirely in the browser with sample data, which is handy for trying changes locally:
```
python3 -m http.server 8000   # then open http://localhost:8000
```

## Releasing an update
Bump `VERSION` in `sw.js` so phones pick up the new files, then push to `main`.

## Calendar
The **Dagatal** tab shows the Google calendars "Heimilið" and "Heimilið vol.2", read-only. The Supabase Edge Function `supabase/functions/clever-api/index.ts` fetches each calendar's secret iCal address and expands repeating events. It assigns each event to whoever is named in the title (inflected names count: Ölmu, Thelmu, Pétri, Odds). Events with no name go to the whole family (Heimilið) or to Oddur (vol.2). An event that appears in both calendars is shown once.

Setup: in Supabase **Edge Functions → Secrets**, add one secret per calendar whose name starts with `ICAL_` (the value is the calendar's "Secret address in iCal format"; `webcal://` links from iCloud work too). If the rest of the name is a profile id (`ICAL_ODDUR` → `oddur`), events with no name in the title belong to that person; otherwise (`ICAL_HEIMILID`, `ICAL_FJOLSKYLDA`) to the whole family. Then deploy the function (its name goes in `fn` in `js/config.js`; currently `clever-api`) with **Verify JWT** turned off. The function checks the family login itself.

Names are read from the profiles, so no code changes are needed per family. The first name and its common inflections match (Odds, Pétri, Thelmu, Ölmu, Kristínar), but only as a whole word with an inflection ending, so "annað" does not count as Anna. Nicknames or irregular forms go in the profile's `aliases` column (run `supabase/7-gaelunofn.sql` once to add it).

## Notifications
Oddur and Kristín see a **＋** next to their avatar on the home screen. From there they send a message to the whole family or to one person. The message arrives as a push notification on every phone that has notifications turned on, and it also shows in a "Skilaboð" card on the home screen for 1 hour (`NOTICE_TTL` in `js/app.js`). Each person can close a message sooner with ×.

- The same function (`clever-api`) sends the notifications. Its push keys are created automatically the first time and stored in the `app_settings` table, which only the server can read.
- Database: run `supabase/3-tilkynningar.sql` once.
- iPhone: needs iOS 16.4 or newer, and the app must be opened from the home screen. Each person taps "Kveikja á tilkynningum" once.

## Reminders (Áminningar)
A fixed "📌 Áminningar" card sits at the top of everyone's home screen and shows today's reminders for that person (plus family-wide ones). Ticking a reminder off removes it from the home screen for the day; repeating ones come back on their next day.

- Anyone can add reminders for themselves. Oddur and Kristín can also add them for a child or for the whole family.
- A reminder repeats on chosen weekdays (every day, weekdays, weekends, or specific days), or happens once on a given date.
- With a time set, a push notification goes to that person's phone at that time. A scheduler in the database (`pg_cron`) calls `clever-api` every 5 minutes with a secret key, and each reminder is sent at most once a day. Reminders already ticked off are skipped.
- Database: run `supabase/4-aminningar.sql` once.

## Chores and the weekly trophy (Verk)
- The **Verk** tab shows parents the weekly leaderboard (Monday to Sunday, kids only). Kids never see the leaderboard, only their own points for the week. Tied scores share a place. Whoever tops last week's board gets 🏆 on their avatar, and the real trophy goes to their room. The parents announce the winner themselves on Sunday evening; the app sends no automatic winner notification.
- Kids see "Verkin mín í dag" on their home screen and tap a chore when it's done. Small chores give points straight away. Bigger chores (`needs_approval`) wait for a parent, who gets a notification and approves (✓) or sends it back (✕) from the home screen. The kid then gets a notification either way.
- Each chore is either `each` (everyone does their own, like making the bed) or `anyone` (first one to do it gets the points, like taking out the trash). Each chore also has its points, its weekdays, and optionally which kids it's for.
- Parents manage chores under **⚙️ Sýsla með verkin**.
- Database: run `supabase/5-heimilisverk.sql` once. It also adds the six starter chores.

## Saman (photos, kudos, wishlists)
The **Saman** tab has three parts. (Innkaup and Matseðill share the **Matur** tab.)
- **📸 Photo of the day:** everyone can post one photo a day, and it must be taken that day. "Taka mynd" opens the camera; a photo picked from the library must carry today's capture date (EXIF), otherwise it's refused. Photos are shrunk to 1440px and stored in the private Storage bucket `myndir`, readable only by the signed-in family through signed links. The family can react with ❤️😂😍👏🔥. "Árið okkar" shows every photo by month. At 18:00, if nobody has posted a photo that day, everyone gets a reminder.
- **💛 Kudos:** anyone sends kudos to one person or to everyone. The recipient gets a notification, and everyone sees the wall. Today's kudos show on the home screen.
- **🎁 Wishlists:** each person keeps their own list. Others can reserve an item ("Ég kaupi þessa"), and the owner never sees what's been reserved. The owner marks "Fékk þetta" to remove an item.
- Database: run `supabase/6-saman.sql` once. It creates the tables and the Storage bucket.

## Story
Round avatars at the top of the home screen. Anyone can post one or more photos (new or old, from the camera or the library), and they disappear after **24 hours**. A coloured ring means there's something you haven't seen yet (remembered on this phone only, never shown to others). There is no "seen by" list and no notification when someone posts.

- Tap a ring to watch full screen: tap right = next, left = back, hold = pause, swipe down = close. When one person's photos end, the next person's start.
- Emoji reactions (❤️😂😍👏🔥) like on Photo of the day. You can delete your own story early; parents can also take down a child's.
- Photos are shrunk to 1440px and kept in the same locked `myndir` bucket under `story/`. The 5-minute clock in `clever-api` deletes expired photos from storage, so space doesn't fill up.
- Code: `js/story.js`. Database: run `supabase/8-story.sql` once, and redeploy `clever-api` so expired photos get cleaned up.

## Streaks and weekly chore review
Each chore a child has done several scheduled times in a row shows 🔥 and the count (kids see only their own). Parents get a **Síðustu 7 dagar** card under Verk: per child "X af Y verkum", their longest streak, and the three chores forgotten most often. Computed in `js/app.js` (`streakOf`, `weekReviewCard`) from `chore_log`; no SQL needed.

## Upplýsingabók (family info book)
Opened from the menu when you tap your own avatar at the top → **Upplýsingabók**. Code: `js/book.js`. Database: run `supabase/9-upplysingabok.sql` once.

- **Heimilið:** WiFi networks and codes (e.g. a key box). Values are hidden until you tap the eye. A WiFi network has a **QR code for guests**: they point their phone camera at it and join (standard `WIFI:` format). Parents add and edit; an item can be marked **Bara foreldrar** so the kids never see it.
- **Afmæli:** the family's own birthdays (a birth date on each profile, set by parents) plus extended family (anyone can add; year is optional). A card shows on the home screen **on the day itself** only, with no reminder before and no notification.
- **Stærðir:** clothes, trousers, shoes and other per person. Parents fill them in; kids **15 and older** can edit their own (age comes from the birth date). The sizes also show at the top of that person's wishlist.
- The WiFi QR code is drawn by `js/vendor/qrcode.js` (qrcode-generator, MIT), loaded only when needed.

## Joke of the day
The "Brandari dagsins" card sits at the bottom of the home screen. Everyone gets the same joke that day, and all the jokes in `js/jokes.js` come round before any repeats. Question jokes hide their punchline behind "Sjá svarið". To add a joke, add a line `{ q: '…', a: '…' }` to `js/jokes.js`.

## Look
- The **Notion** style comes from [better-design](https://github.com/marvkr/better-design) (`components/notion`): warm neutral colours, hairline borders, callout boxes and 4px corners. It lives as the "ÚTLIT: Notion" block at the end of `styles.css`. The full design system is also kept in Claude Design ("Fjölskylduvikan").
- **Icons:** [Lucide](https://lucide.dev) line icons (ISC licence). Only the icons the app needs are bundled in `js/icons.js`; use them with `icon('name')`. Emoji are kept where they're content: photos, kudos, reactions, chore icons and profiles.
- **App icon:** the family monogram, in `icons/`.

## Another family (test families)
Every family gets its **own Supabase project** (its own data, login and calendar secrets) but uses the **same app and the same link**. Updates pushed to GitHub reach every family at once.

1. New Supabase project. Edit the two "BREYTTU HÉR" blocks at the top of `supabase/ny-fjolskylda.sql` (project URL, the people) and run the whole file in the SQL Editor.
2. Add the family user (Authentication → Users), turn off sign-ups, deploy `clever-api` with Verify JWT off, add the `ICAL_…` secrets.
3. Add the family to `FAMILIES` in `js/config.js` with a neutral code (e.g. `prufa1`, not their surname: the repo is public) and push.
4. Send them `https://oddurhelgigudmundsson.github.io/fjolskylduvikan/?f=<code>`. A phone that opens the app without the code is asked for it once; phones set up before this change stay with the first family.

**Database changes later:** a new `supabase/N-….sql` must be run on **every** family's project, and the Edge Function redeployed in each. After changing any `.sql` file, run `python3 tools/build_setup_sql.py` so new families get everything.

The full step-by-step guide and the user guide for the test family are kept as Claude Docs.

## Statistics (Tölfræði)
**Overview of all families in one place:** `https://oddurhelgigudmundsson.github.io/fjolskylduvikan/tolfraedi.html`. The page asks every family in `js/config.js` for anonymous totals (action `stats` in `clever-api`) and shows active families, active people and kids, active days, a weekly chart and a card per family. Nothing with names or content leaves the database: people show as "Foreldri 1", "Barn 2".

Setup, once per family project: add the secret `ADMIN_KEY` (the same long random key in every project) under Edge Functions → Secrets, and make sure the latest `clever-api` is deployed. Then open the page and enter the key once; it's remembered in that browser. Without `ADMIN_KEY` the function never answers stats requests.

The SQL files below give the same numbers straight from one project's SQL Editor:
Two read-only queries built on what the database already stores (nothing extra is tracked). Paste into each family's SQL Editor and Run:
- `supabase/tolfraedi-vikur.sql`: one row per week for the last 12 weeks: active people (parents/kids), active days, chores, shopping, photos, kudos, reminders, messages.
- `supabase/tolfraedi-folk.sql`: one row per person for the last 28 days: PIN chosen, notifications on, active days, actions per area, points, last active.

Limits: cleared shopping items and expired stories are gone, and app opens are not recorded, so these count *activity*, not visits.

## Backlog
Ideas that have been looked at but not built are in [BACKLOG.md](BACKLOG.md), ranked by priority with an overview table at the top. Loose, unsorted ideas live in [HUGMYNDIR.md](HUGMYNDIR.md). Bigger ideas that need the app to grow first (full Krónan checkout, inviting grandparents as guests) are in [FRAMTID.md](FRAMTID.md).
