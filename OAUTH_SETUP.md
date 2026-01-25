# OAuth System Browser Login - Deployment Guide

## Overview

The AI Floating Assistant now uses secure OAuth flow with Google login in the system browser. This guide walks through deploying the backend and configuring the app.

---

## Part 1: Deploy Backend to Vercel

### 1.1 Prerequisites

- Vercel account ([sign up free](https://vercel.com/signup))
- Vercel CLI installed globally:
  ```powershell
  npm install -g vercel
  ```

### 1.2 Deploy Backend

```powershell
# Navigate to backend folder
cd c:\Users\ankit\Desktop\AI_PIN\backend

# Install dependencies
npm install

# Login to Vercel (opens browser)
vercel login

# Deploy to production
vercel --prod
```

**Copy the deployment URL** (e.g., `https://your-app-name.vercel.app`)

---

## Part 2: Configure Google OAuth

### 2.1 Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. **Create Project** (if new):
   - Click "Select Project" → "New Project"
   - Name: `AI Floating Assistant`
   - Click "Create"

3. **Enable Google+ API**:
   - Go to "APIs & Services" → "Enable APIs and Services"
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth Client**:
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Name: `AI Floating Assistant`
   - **Authorized redirect URIs**: Add your Vercel URL + callback path
     ```
     https://your-app-name.vercel.app/auth/google/callback
     ```
   - Click "Create"
   - **COPY** your Client ID and Client Secret

---

## Part 3: Configure Vercel Environment Variables

### 3.1 Add Secrets to Vercel

Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Settings → Environment Variables
4. Add the following (one at a time):

| Variable               | Value                                              | Example                                 |
| ---------------------- | -------------------------------------------------- | --------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Your Client ID from Google Console                 | `123456-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Your Client Secret from Google Console             | `GOCSPX-abcdefg...`                     |
| `GOOGLE_REDIRECT_URI`  | `https://your-app.vercel.app/auth/google/callback` | Must match Google Console exactly       |
| `JWT_SECRET`           | Random secure string (see below)                   | `a1b2c3d4e5f6g7h8...`                   |

**Generate JWT_SECRET**:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Option B: Via Vercel CLI

```powershell
cd backend
vercel env add GOOGLE_CLIENT_ID
# Paste your client ID when prompted
vercel env add GOOGLE_CLIENT_SECRET
# ... repeat for each variable
```

### 3.2 Redeploy

```powershell
vercel --prod
```

---

## Part 4: Update Electron App

### 4.1 Set Backend URL

Edit `app/renderer/renderer.js`, find line ~998:

```javascript
const OAUTH_BACKEND_URL = "https://your-app-name.vercel.app"; // Replace this!
```

Replace `'YOUR_VERCEL_URL_HERE'` with your actual Vercel URL (no trailing slash).

### 4.2 Rebuild App

```powershell
cd c:\Users\ankit\Desktop\AI_PIN
npm run dist
```

---

## Part 5: Test OAuth Flow

### 5.1 Test Backend Health

Open browser to:

```
https://your-app-name.vercel.app
```

Should see:

```json
{
  "status": "ok",
  "service": "AI Floating Assistant OAuth Backend",
  "timestamp": "..."
}
```

### 5.2 Test OAuth Flow (Manual)

1. Open browser to:
   ```
   https://your-app-name.vercel.app/auth/google/start
   ```
2. Should redirect to Google login
3. After login, redirects to `aifloatingassistant://auth-success?token=...`
4. If Electron app is running, it should open and show "Successfully logged in!"

### 5.3 Test from Electron App

1. Run the app:
   ```powershell
   npm start
   ```
2. Navigate to Gemini or any AI requiring Google login
3. When Google login page appears, a modal should show:
   - **Title**: "Login Required"
   - **Message**: "Google requires login in your system browser for security"
   - **Button**: "Login with Google"
4. Click "Login with Google"
5. System browser should open
6. Login with Google
7. App should come to foreground
8. Toast: "✅ Successfully logged in!"

---

## Troubleshooting

### Issue: "Invalid redirect URI"

- **Cause**: Mismatch between Google Console and Vercel ENV
- **Fix**: Ensure `GOOGLE_REDIRECT_URI` in Vercel exactly matches the redirect URI in Google Console (including `https://` and `/auth/google/callback`)

### Issue: "Invalid state parameter"

- **Cause**: Stale OAuth session
- **Fix**: Clear browser cookies and retry

### Issue: "Protocol not registered" (Windows)

- **Cause**: App needs to be installed, not run from `npm start`
- **Fix**: Build and install: `npm run dist`, then install the `.exe` from `dist/`

### Issue: Token not saving

- **Cause**: OAuth callback listener not attached
- **Fix**: Check browser console for errors, ensure `window.electronAPI.onAuthSuccess` is defined

### Issue: "Failed to open system browser"

- **Cause**: `electronAPI.openExternal` not available
- **Fix**: Rebuild preload.js, ensure it's loaded

---

## Security Notes

- **Never commit `.env` file** - Already in `.gitignore`
- **Rotate JWT_SECRET** every 6 months
- **Use HTTPS only** in production (Vercel provides this automatically)
- **Monitor Vercel logs** for suspicious activity: `vercel logs`

---

## Next Steps

- [ ] Deploy backend to Vercel
- [ ] Configure Google OAuth Client
- [ ] Add environment variables to Vercel
- [ ] Update `OAUTH_BACKEND_URL` in renderer.js
- [ ] Rebuild and test Electron app
- [ ] Update app version and publish new release

---

For issues, see [GitHub Issues](https://github.com/ankit3890/AI-Floating-Assistant/issues)
