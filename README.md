# PMSI Mobile App

Property maintenance photo capture and upload to Google Drive.

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_ROOT_FOLDER=PMSI
VITE_GOOGLE_DRIVE_PMSI_FOLDER_ID=
GOOGLE_VISION_API_KEY=your_google_vision_api_key
```

- `VITE_*` variables are used by the React app (Google sign-in, folder name).
- `VITE_GOOGLE_DRIVE_PMSI_FOLDER_ID` (optional) — use the shared PMSI folder ID directly; skips name search when set.
- `GOOGLE_VISION_API_KEY` is **server-only** — used by `/api/extract-address` (Google Cloud Vision OCR), never sent to the browser.

### 2. Install Dependencies

```bash
npm install
npm run generate-icons
```

### 3. Run Locally

**Development** (Vite + API middleware for address extraction):

```bash
npm run dev
```

Visit `http://localhost:5173`

**Production-like** (build + Express with API):

```bash
npm run build
GOOGLE_VISION_API_KEY=... npm start
```

Visit `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
npm start
```

## Deployment to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app)
3. Connect your GitHub repo
4. Add environment variables in Railway dashboard:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_GOOGLE_DRIVE_ROOT_FOLDER`
   - `VITE_GOOGLE_DRIVE_PMSI_FOLDER_ID` (optional)
   - `GOOGLE_VISION_API_KEY`
5. Railway auto-deploys on every push

## Tech Stack

- React 18 + Vite
- Express (production server + `/api/extract-address`)
- Google Identity Services (OAuth access token)
- Google Drive API v3
- Google Cloud Vision OCR + regex/heuristics (address extraction, server-side only)
- PWA (installable home screen app with icons)

## App Flow

1. **Login** — Tech signs in with Google (OAuth access token for Drive)
2. **Form** — Select customer, enter address manually, or extract from camera/image/PDF/Word
3. **Camera** — Take photos; each uploads immediately (queued if offline)
4. **Upload** — Photos go to `PMSI / [Customer] / [Address folder]`
5. **Persistence** — Form fields persist until logout; session up to 8 hours

## Folder Structure

All uploads go to:

```
PMSI / [Customer] / [Address - Unit X] / [CO#N]  (CO# is a subfolder when used)
```

- PMSI folder is pre-created and shared with each tech's Google account
- Customer folders are pre-created under PMSI
- Address folders are auto-created by the app

## Google Cloud Console

See audit notes or configure:

1. **OAuth 2.0 Client ID** (Web application)
   - Authorized JavaScript origins: your app URL (e.g. `http://localhost:5173`, production URL)
   - No redirect URI required for token client flow
2. **OAuth consent screen** — add test users while in Testing mode
3. Enable **Google Drive API**
4. Scope used: `https://www.googleapis.com/auth/drive`

## Mobile Installation

### iPhone (iOS)

1. Open app URL in Safari
2. Tap Share → Add to Home Screen

### Android

1. Open app URL in Chrome
2. Menu → Add to Home Screen

## Features

- Google OAuth login (each tech with own account)
- Customer dropdown (auto-loads from Drive)
- Address input (manual, camera scan, image/PDF/Word upload for OCR extract)
- Per-photo upload with offline queue + retry (on open, reconnect, every 10 min)
- Session timeout (8 hours max, or Google token expiry)
- PWA install (iOS Safari / Android Chrome)

## Troubleshooting

**Camera not working?** HTTPS required on mobile; allow camera permission.

**Upload failing?** Confirm PMSI folder is shared with the tech's Google account and customer folder exists.

**Address extraction failing?** Use a clear photo or text-based PDF/Word doc. Enable Vision API in Google Cloud. Scanned PDFs without a text layer may need a photo instead.

**PMSI folder not found?** Set `VITE_GOOGLE_DRIVE_PMSI_FOLDER_ID` to the shared folder ID from Drive URL.

## Questions?

Contact: sandy@propflow360.com
