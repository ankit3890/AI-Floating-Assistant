# Quick Vercel Deployment Steps

## 1. Login to Vercel

Open PowerShell and run:

```powershell
cd c:\Users\ankit\Desktop\AI_PIN\backend
vercel login
```

A browser will open - log in with GitHub, GitLab, or email.

## 2. Deploy to Production

After login, run:

```powershell
vercel --prod
```

**Follow the prompts:**

- Set up and deploy? → **Yes**
- Which scope? → Choose your account name
- Link to existing project? → **No**
- What's your project's name? → Press **Enter** (use default: `backend`)
- In which directory is your code located? → Press **Enter** (use `.`)
- Want to override settings? → **No**

## 3. Copy Deployment URL

After deployment succeeds, you'll see:

```
✅ Production: https://backend-xxxxx.vercel.app [copied to clipboard]
```

**SAVE THIS URL** - you'll need it for:

1. Google Cloud Console redirect URI
2. Updating the Electron app

## Next Steps

After deployment, you need to:

1. Configure Google OAuth (I'll help with this)
2. Add environment variables to Vercel
3. Update the Electron app with your backend URL
