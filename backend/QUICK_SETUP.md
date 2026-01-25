# Quick Setup Checklist

## ✅ Step 1: Backend Deployed
**URL**: https://ai-floating-assistant.vercel.app
Status: Deployed (404 is normal before env vars are added)

---

## 📋 Step 2: Google OAuth (Do This Now)

### Quick Steps:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth Client ID → **Web application**
3. Add redirect URI (EXACT):
   ```
   https://ai-floating-assistant.vercel.app/auth/google/callback
   ```
4. Copy **Client ID** and **Client Secret**

---

## 🔐 Step 3: Add Environment Variables to Vercel

### Go to Vercel:
1. https://vercel.com/dashboard
2. Click your project → **Settings** → **Environment Variables**

### Add These 4 Variables:

| Name | Value | Where to Get |
|------|-------|--------------|
| `GOOGLE_CLIENT_ID` | Your Client ID | From Google Console |
| `GOOGLE_CLIENT_SECRET` | Your Client Secret | From Google Console |
| `GOOGLE_REDIRECT_URI` | `https://ai-floating-assistant.vercel.app/auth/google/callback` | Copy exactly |
| `JWT_SECRET` | Random string | See below ⬇️ |

### Generate JWT_SECRET:
Run in PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (long random string).

---

## 🔄 Step 4: Redeploy

After adding all 4 variables:
1. Go to **Deployments** tab
2. Click **•••** on latest deployment
3. Click **Redeploy**
4. Wait ~1 minute

---

## ✅ Step 5: Test

Visit: https://ai-floating-assistant.vercel.app/

Should show:
```json
{
  "status": "ok",
  "service": "AI Floating Assistant OAuth Backend"
}
```

---

## 🆘 Need Help?

If you get stuck, let me know at which step!
