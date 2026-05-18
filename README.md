# PMSI Mobile App

Property maintenance photo capture and upload to Google Drive.

## Setup

### 1. Environment Variables

Edit `.env.local` and add:

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_OPENAI_API_KEY=sk_your_openai_api_key
VITE_GOOGLE_DRIVE_ROOT_FOLDER=PMSI
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Locally

```bash
npm run dev
```

Visit `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

## Deployment to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app)
3. Connect your GitHub repo
4. Add environment variables in Railway dashboard:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_OPENAI_API_KEY`
   - `VITE_GOOGLE_DRIVE_ROOT_FOLDER`
5. Railway auto-deploys on every push

## Tech Stack

- React 18 + Vite
- Google Drive API v3
- OpenAI Vision (address extraction)
- PWA (offline support, home screen install)

## App Flow

1. **Login** — Tech signs in with Google
2. **Form** — Select customer, enter/scan address, select unit (optional)
3. **Camera** — Take continuous photos (no phone storage)
4. **Auto-upload** — Photos auto-upload to Drive on "Done"
5. **Persistence** — Form stays same until logout

## Folder Structure

All uploads go to:

```
PMSI / [Customer] / [Address] (or [Address - CO#] or [Address - Unit X])
```

- PMSI folder is pre-created by you
- Customer folders are pre-created by you
- Address folders are auto-created by the app

## Mobile Installation

### iPhone (iOS)

1. Open app URL in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Tap "Add"

### Android

1. Open app URL in Chrome
2. Tap menu (3 dots)
3. Tap "Add to Home Screen"
4. Confirm

## Features

✅ Google OAuth login (each tech with own account)
✅ Customer dropdown (auto-loads from Drive)
✅ Address input (manual, camera snap, file upload)
✅ AI address extraction (OpenAI Vision)
✅ Duplicate detection (warns on duplicate address, allows CO#)
✅ Continuous camera (no phone storage, auto-uploads)
✅ Offline queue (IndexedDB, 10-min retry, next-day prompt)
✅ Session timeout (8 hours auto-logout)
✅ PWA (offline, home screen install)
✅ Dark theme + PMSI branding

## Troubleshooting

**Camera not working?** Check browser permissions. HTTPS required for camera access.

**Upload failing?** Check internet connection. App queues automatically and retries every 10 minutes.

**Photos not in Drive?** Verify you shared PMSI folder with tech's Google account.

## Questions?

Contact: sandy@propflow360.com
