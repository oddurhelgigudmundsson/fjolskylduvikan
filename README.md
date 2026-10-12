# Fjölskylduvikan

The family's home-screen app: shared shopping list, weekly menu, and (coming next) calendars, chores and notifications.

It is a plain static web app: no build step. It is hosted on **GitHub Pages**, and the data lives in **Supabase**.

```
index.html             app shell
styles.css             all styling (light + dark mode)
js/config.js           Supabase URL + anon key  ← the only file you edit to connect
js/app.js              screens: profiles/PIN, home, shopping list, menu
js/data.js             data layer (Supabase, or demo mode when config is empty)
js/util.js             Icelandic dates, auto-categorising shopping items
sw.js                  service worker (fast start, works on weak signal)
manifest.webmanifest   home-screen app settings
supabase/schema.sql    database tables, security rules, the 5 profiles
```

## One-time setup

### 1. Database (Supabase)
1. Supabase → **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
2. **Authentication → Users → Add user → Create new user**: one shared family email and password, with **Auto Confirm User** ticked. Everyone logs in with this once per phone.
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up", so nobody else can create an account.
4. Put the **Project URL** and **anon / publishable key** into `js/config.js`.

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

## Next stages
1. Calendars: read the "Heimilið" and "Heimilið vol.2" Google calendars and place each event on the right person by the name in its title.
2. Chores with points, approvals, streaks and a reward shop.
3. Push notifications from parents to everyone or selected people.
