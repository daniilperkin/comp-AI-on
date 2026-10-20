# Firebase mirror — phone view + backup (optional)

comp[AI]on is local-first: SQLite is authoritative and nothing leaves the
machine unless you set this up. The mirror is one-way:

```
SQLite (backend)  --push-->  Firestore  --read-->  phone SPA (Firebase Hosting)
```

Only non-secret settings are mirrored; anything whose key contains
`token/secret/password/api_key/credential/private/key` is skipped. Firestore
rules allow reads only for signed-in Google accounts; only the backend (Admin
SDK) writes.

## One-time setup (Firebase console)

1. https://console.firebase.google.com → **Add project** (e.g. `companion-mirror`).
2. **Build → Firestore Database → Create database** → Native mode, pick a region
   (e.g. `europe-west1`).
3. **Project settings (gear) → Service accounts → Generate new private key** —
   save the JSON somewhere outside the repo, e.g.
   `C:\Users\<you>\firebase\companion-service-account.json`.
   (Never commit it — `*.json` service keys are credentials.)
4. **Build → Authentication → Get started → Google** provider → enable.
   Add your Google account as a test user if prompted.
5. **Build → Hosting → Get started** (just to create the site; the CLI deploy
   below is what actually publishes).

## Backend (mirror push)

Put these in the repo-root `.env` (see `.env.example`):

```
COMPANION_FIREBASE_CREDENTIALS=C:\Users\<you>\firebase\companion-service-account.json
COMPANION_FIREBASE_PROJECT_ID=companion-mirror
```

Restart the backend. It mirrors on startup and every 15 minutes, and exposes:

- `GET  /api/sync/firebase/status`
- `POST /api/sync/firebase/run`

Toggle with the `firebase_mirror_enabled` setting.

## Phone view (Firebase Hosting)

Build the read-only SPA with your web-app config (Project settings → Your apps
→ Web app → SDK setup; the `firebaseConfig` object):

```powershell
cd frontend
$env:VITE_DATA_SOURCE = "firestore"
$env:VITE_FIREBASE_CONFIG = '{"apiKey":"...","authDomain":"companion-mirror.firebaseapp.com","projectId":"companion-mirror","appId":"..."}'
npm run build:mirror
cd ..
npx firebase-tools deploy --only hosting,firestore:rules
```

First deploy asks you to log in (`npx firebase-tools login`) and to pick the
project (`.firebaserc` already names `companion-mirror`).

The app opens on Firebase Hosting, asks for Google sign-in on the first read
(the rules require `request.auth != null`), and then renders the mirrored
dashboard read-only — edits still happen in the desktop app.
