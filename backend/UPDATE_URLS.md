# ⚠️ IMPORTANT: Update OAuth URLs

Your backend URL changed to: `https://ai-floating-assistant-ffyp.vercel.app`

You need to update this URL in 2 places:

---

## 1. Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth Client ID
3. Under **"Authorized redirect URIs"**, update to:
   ```
   https://ai-floating-assistant-ffyp.vercel.app/auth/google/callback
   ```
4. Click **"SAVE"**

---

## 2. Vercel Environment Variables

1. Go to: https://vercel.com/dashboard
2. Your project → **Settings** → **Environment Variables**
3. Find `GOOGLE_REDIRECT_URI`
4. Click **Edit** (pencil icon)
5. Change value to:
   ```
   https://ai-floating-assistant-ffyp.vercel.app/auth/google/callback
   ```
6. Click **Save**
7. **Redeploy** (Deployments tab → ••• → Redeploy)

---

## 3. Test OAuth Flow

After updating both, test it:

Visit: `https://ai-floating-assistant-ffyp.vercel.app/auth/google/start`

Should redirect to Google login, then after login show: `aifloatingassistant://auth-success?token=...`

---

## Next Step

Once OAuth works, we'll update the Electron app with this URL!
