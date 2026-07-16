# Batch → Drive

Bulk-upload iPhone HEIC photos from your phone. Each one gets converted to
PNG, compressed, and filed into a Google Drive folder named for today's date.

## How it works

1. You pick (or drag in) as many photos as you want.
2. The app creates (or reuses) today's dated folder in your Drive folder.
3. Each photo is sent to the server one at a time (a few in parallel),
   where it's decoded from HEIC if needed, compressed as PNG, and uploaded
   straight into that folder.
4. When it's done, you get a link straight to the folder.

Photos never touch your own Google account's browser session — the app
authenticates as a **service account**, a robot Google account you create
once and share your Drive folder with.

## One-time setup (Google Cloud)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a new project (or reuse one).
2. **APIs & Services → Library** → search "Google Drive API" → Enable.
3. **APIs & Services → Credentials → Create Credentials → Service account.**
   Name it anything (e.g. `photo-pipeline-bot`). No roles needed, no user
   access needed — click through to Done.
4. Open the service account you just made → **Keys** tab → **Add Key →
   Create new key → JSON**. This downloads a `.json` file — keep it private,
   don't commit it.
5. Open that JSON file. You need two values from it:
   - `client_email` → this is `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → this is `GOOGLE_PRIVATE_KEY` (keep the `\n` characters
     exactly as they appear in the file, quotes included)
6. In Google Drive, create (or pick) the folder you want everything filed
   into. Open it, click **Share**, and share it with the `client_email`
   address from step 5 (give it **Editor** access). This is the step people
   most often forget — without it, uploads will fail with a permissions
   error.
7. Copy that folder's ID out of its URL:
   `drive.google.com/drive/folders/`**`THIS_PART`**
   → this is `GOOGLE_DRIVE_PARENT_FOLDER_ID`.

## One-time setup (Vercel)

1. Push this project to a GitHub repo, then import it in Vercel
   (New Project → your repo).
2. In the Vercel project's **Settings → Environment Variables**, add the
   values from above, plus a passcode of your choosing:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` — tick the **Sensitive** checkbox when adding this
     one so it's hidden from the dashboard after saving
   - `GOOGLE_DRIVE_PARENT_FOLDER_ID`
   - `APP_PASSCODE` — anything you and Alex will remember; this is the only
     thing standing between a random visitor and your Drive folder, since
     the app itself has no other login
3. Deploy. No Google login screen for you or Alex, since the app
   authenticates to Drive as the service account server-side — you'll just
   see a passcode screen the first time you open the app on a device.

## Security notes

- The service account has **no project-level permissions** — its only
  access is whatever Drive folder you explicitly share with it. If its key
  ever leaks, revoke it in Cloud Console (**Keys** tab → delete) and issue
  a new one; nothing else on your Google account is exposed.
- The passcode gates both API routes (`/api/folder`, `/api/photo`)
  server-side, not just the page — so it can't be bypassed by calling the
  API directly. It's stored in the browser's `sessionStorage`, so it
  clears when the tab/browser closes.
- This is a lightweight gate suited to a small private tool, not a full
  auth system — good enough to stop randoms who find the URL from spamming
  your Drive, not meant to survive a determined attacker.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your real values
npm run dev
```

## Known platform limits (worth knowing, not bugs)

- **Vercel caps request bodies at 4.5MB per serverless function call.**
  That's why photos upload one at a time instead of all in one request —
  the app already works around this. A handful of huge originals (ProRAW,
  panoramas, long Live Photo captures) may occasionally exceed 4.3MB and
  get skipped with a clear error; everything else goes through fine.
- Each photo is resized so its longest edge is at most 2400px and
  compressed as a palette PNG. This keeps files small (typically
  70–90% smaller than the original HEIC) without visible quality loss for
  normal viewing. If you want the originals kept at full resolution,
  that's a one-line change in `lib/convert.ts` (remove the `resize` call).
- On Vercel's free (Hobby) tier, function execution is capped — this app
  requests up to 60 seconds per photo (`maxDuration = 60` in
  `app/api/photo/route.ts`), which is fine for individual photos but
  confirm your plan supports it if uploads start timing out.

## Project structure

```
app/
  page.tsx              the whole UI (upload zone, pipeline rail, photo list)
  api/folder/route.ts    creates/reuses today's dated Drive folder
  api/photo/route.ts     converts + compresses + uploads one photo
lib/
  convert.ts             HEIC→PNG decode + compression (sharp + heic-convert)
  drive.ts               Google Drive auth + folder/file operations
```
