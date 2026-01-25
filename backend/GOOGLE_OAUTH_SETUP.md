# Google OAuth Setup Guide

Your backend is deployed! Now let's configure Google OAuth and add environment variables.

**Backend URL**: `https://ai-floating-assistant.vercel.app`

---

## Step 1: Google Cloud Console Setup

### 1.1 Create OAuth Client

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)

2. If you don't have a project:
   - Click "Select Project" → "New Project"
   - Name: `AI Floating Assistant`
   - Click "Create"

3. **Create OAuth Client ID**:
   - Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
   - If prompted to configure consent screen, click "Configure Consent Screen":
     - User Type: **External**
     - App name: `AI Floating Assistant`
     - User support email: Your email
     - Developer contact: Your email
     - Click "Save and Continue" → "Save and Continue" (skip scopes) → "Save and Continue"
     - Add test users (your email) if needed
     - Click "Back to Dashboard"

4. **Create OAuth Client**:
   - Go back to Credentials → "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: **Web application**
   - Name: `AI Floating Assistant OAuth`
5. **Add Authorized redirect URI**:

   ```
   https://ai-floating-assistant.vercel.app/auth/google/callback
   ```

   ⚠️ Make sure there are NO typos - must be exact!

6. Click **"CREATE"**

7. **COPY YOUR CREDENTIALS**:
   - Client ID (looks like: `123456-abc.apps.googleusercontent.com`)
   - Client Secret (looks like: `GOCSPX-abcdefg...`)

---

## Step 2: Add Environment Variables to Vercel

### 2.1 Go to Vercel Dashboard

1. Visit [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project: **"ai-floating-assistant"**
3. Go to **"Settings"** tab
4. Click **"Environment Variables"** in the left sidebar

### 2.2 Add Variables

Add these **4 environment variables** (one at a time):

| Variable Name          | Value                                                           | Example                                 |
| ---------------------- | --------------------------------------------------------------- | --------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Paste from Google Console                                       | `123456-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Paste from Google Console                                       | `GOCSPX-abcdefg...`                     |
| `GOOGLE_REDIRECT_URI`  | `https://ai-floating-assistant.vercel.app/auth/google/callback` | Must be exact                           |
| `JWT_SECRET`           | Generate random string (see below)                              | `a1b2c3d4e5f6...`                       |

**Generate JWT_SECRET**:

Run this in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as `JWT_SECRET`.

### 2.3 Redeploy

After adding all 4 variables:

1. Go to **"Deployments"** tab
2. Click the **3 dots (•••)** on the latest deployment
3. Click **"Redeploy"**
4. Confirm redeploy

Wait ~1 minute for redeployment to complete.

---

## Step 3: Test OAuth Flow

After redeploy, test the OAuth flow:

1. Open browser to: `https://ai-floating-assistant.vercel.app/auth/google/start`
2. Should redirect to Google login page
3. Login with Google
4. After login, you'll see: `aifloatingassistant://auth-success?token=...`
5. This will try to open your Electron app (won't work yet until we update the app)

If you see any errors, check the Vercel logs.

---

## Step 4: Update Electron App

Once OAuth is working, we need to update the Electron app with your backend URL.

I'll help you with this in the next step!

---

## Troubleshooting

**"redirect_uri_mismatch" error**:

- Your redirect URI in Google Console doesn't exactly match `https://ai-floating-assistant.vercel.app/auth/google/callback`
- NO trailing slash
- Must be HTTPS
- Must be exact

**"Invalid client" error**:

- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel
- Make sure you copied them correctly
- Make sure you redeployed after adding them

**Still not working?**:

- Check Vercel logs: Go to Deployments → Latest → "Function Logs"
- Share any error messages with me
