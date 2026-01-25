# Deploy Backend to Vercel from GitHub

Your OAuth backend code is now on GitHub! Let's deploy it to Vercel through the web dashboard (easier than CLI).

## Option 1: Deploy via Vercel Web Dashboard (RECOMMENDED)

### Step 1: Import GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New..." → "Project"**
3. Connect your GitHub account if not already connected
4. Find and click **"AI-Floating-Assistant"** repository
5. Click **"Import"**

### Step 2: Configure Project

- **Framework Preset**: Other (or leave auto-detected)
- **Root Directory**: Click **"Edit"** → Select `backend` folder  
  ⚠️ **IMPORTANT**: The root must be `backend` directory, not the main repo
- **Build Command**: Leave empty (not needed for this project)
- **Output Directory**: Leave empty
- **Install Command**: `npm install`

### Step 3: Deploy

Click **"Deploy"** (we'll add environment variables after first deployment)

Wait ~1-2 minutes for deployment to complete.

### Step 4: Copy Production URL

After deployment, you'll see:

```
🎉 Your project is live!
https://backend-xxxxx.vercel.app
```

**SAVE THIS URL** - you need it for:

- Google OAuth configuration
- Updating the Electron app

---

## Option 2: Deploy via Vercel CLI

If you prefer command line:

```powershell
cd c:\Users\ankit\Desktop\AI_PIN\backend

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

Follow prompts as they appear.

---

## Next Steps After Deployment

✅ Backend is deployed!  
⬜ Configure Google OAuth  
⬜ Add environment variables to Vercel  
⬜ Update Electron app with backend URL

Let me know your Vercel URL once deployed, and I'll help with the next steps!
