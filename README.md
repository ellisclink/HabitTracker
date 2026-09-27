# ✅ Habit Tracker

A simple web app for building good habits. Create an account, add the habits you want to keep, and check off each day you complete them. The app shows your last 7 days for every habit and keeps track of your current streak 🔥.

Built for **ED2 – Build Software with AI**, using AI tools (Claude Code) to write the code.

## 🔗 Links

- **Live app:** ellishabittracker.netlify.app
- **Demo video:** https://www.youtube.com/watch?v=6bhiePJpD0Q

## ✨ Features

- **User accounts:** register, log in, and log out (Supabase Auth)
- **Create** a new habit
- **Read** all of your habits, each with a 7-day history and current streak
- **Update:** rename a habit, or tap any of the last 7 days to mark it done or not done
- **Delete** a habit along with its history
- **Private data:** each user can only see and change their own habits, enforced in the database with Row Level Security

## 🛠 Technologies Used

| Part | Technology |
|------|------------|
| Frontend | HTML, CSS, and plain JavaScript (no framework, no build step) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Authentication | Supabase Auth (email + password) |
| Hosting | [Netlify](https://netlify.com) |
| Version control | Git + GitHub |
| AI tools | Claude Code |

## 📁 Project Structure

```
habit-tracker/
├── index.html           # Page layout: login form and habit list
├── style.css            # Styling
├── app.js               # App logic: auth, CRUD operations, rendering, streaks
├── config.js            # Supabase URL + public anon key
├── supabase/
│   └── schema.sql       # Database tables and security policies
├── netlify.toml         # Netlify deploy settings
└── README.md
```

### How it works

- `app.js` uses the Supabase JavaScript client to sign users in and to read and write the database.
- **`habits` table:** one row per habit (`id`, `user_id`, `name`, `created_at`).
- **`habit_logs` table:** one row for each day a habit was completed (`habit_id`, `user_id`, `log_date`). A unique constraint on `(habit_id, log_date)` stops the same day from being counted twice.
- **Row Level Security** policies only allow a logged-in user to access rows where `user_id` matches their own account ID. That makes it safe to include the public anon key in the frontend.
- **Streaks** are calculated in the browser by counting consecutive completed days back from today.

## 🚀 Setup Instructions

### 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) and create a **New project** (the free tier is fine).
2. Open **SQL Editor → New query**, paste in the contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. *(Optional, makes testing easier)* Go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**, so new accounts can log in right away.
4. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

### 2. Configure the app
Open `config.js` and paste in your values:
```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

### 3. Run it locally
The app is just static files. Any local web server will work, for example:
```bash
npx serve .
```
or with Python:
```bash
python -m http.server 8000
```
Then open the URL it prints (for example http://localhost:8000).

### 4. Deploy to Netlify
1. Push the repo to GitHub.
2. In Netlify, choose **Add new site → Import an existing project → GitHub** and select this repo.
3. Leave the build command empty. The publish directory is `.` (already set in `netlify.toml`).
4. Click **Deploy**.
5. In Supabase, go to **Authentication → URL Configuration** and set the **Site URL** to your Netlify URL. Email confirmation links will then point to the live site.
