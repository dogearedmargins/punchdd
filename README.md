# Punchd — Deployment Guide

## What's inside
```
punchd/
├── index.html          ← HTML entry point
├── vite.config.js      ← Build config
├── package.json        ← Dependencies
├── vercel.json         ← Vercel hosting + security headers
├── .gitignore
└── src/
    ├── main.jsx        ← React entry
    └── App.jsx         ← Your entire app
```

---

## Step-by-step: Deploy to Vercel (free)

### Prerequisites
- A computer with internet access
- A free account at github.com
- A free account at vercel.com (sign up with your GitHub account)

---

### Step 1 — Install Node.js
Go to https://nodejs.org and download the **LTS** version. Install it.

Verify it worked — open Terminal (Mac) or Command Prompt (Windows) and type:
```
node -v
```
You should see something like `v20.x.x`.

---

### Step 2 — Set up the project locally
Unzip this folder somewhere on your computer, then open Terminal in that folder.

Install dependencies:
```bash
npm install
```

Test it runs locally:
```bash
npm run dev
```
Open http://localhost:5173 in your browser. You should see the app.

Press `Ctrl+C` to stop the dev server when done.

---

### Step 3 — Create a GitHub repository
1. Go to https://github.com → click **New repository**
2. Name it `punchd` (or whatever you like)
3. Keep it **Public** or **Private** — both work fine with Vercel
4. Click **Create repository**

---

### Step 4 — Push your code to GitHub
In your Terminal (inside the project folder):
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/punchd.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your actual GitHub username.

---

### Step 5 — Deploy on Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New → Project**
3. Find your `punchd` repository and click **Import**
4. Vercel will auto-detect Vite. Leave all settings as-is.
5. Click **Deploy**

That's it. In about 30 seconds you'll get a live URL like:
`https://punchd.vercel.app`

---

### Step 6 — (Optional) Add a custom domain
1. In your Vercel project → **Settings → Domains**
2. Enter your domain (e.g. `punchd.com`)
3. Follow the DNS instructions Vercel gives you

---

## What the security headers do (vercel.json)

| Header | What it prevents |
|--------|-----------------|
| `Content-Security-Policy` | Stops injected malicious scripts from running |
| `X-Frame-Options: DENY` | Stops your site being embedded in iframes (clickjacking) |
| `X-Content-Type-Options` | Stops browsers from guessing file types |
| `Referrer-Policy: no-referrer` | Your URL isn't leaked when users click external links |
| `Permissions-Policy` | Explicitly blocks access to camera, mic, location |

---

## Privacy summary
- ✅ Images never leave the user's device
- ✅ No database, no backend, no user accounts
- ✅ No cookies
- ⚠️  Google Fonts loads from Google's CDN (they see the user's IP)
  - To eliminate this: download the fonts and put them in `/public/fonts/`

---

## Future updates
Whenever you change `src/App.jsx`, just run:
```bash
git add .
git commit -m "Update app"
git push
```
Vercel auto-deploys on every push. Done.
