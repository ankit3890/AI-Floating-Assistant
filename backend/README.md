# AI Floating Assistant - OAuth Backend

OAuth backend server for handling Google authentication securely.

## Setup Instructions

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
4. Choose **Web Application**
5. Add Authorized Redirect URIs:
   - Development: `http://localhost:3000/auth/google/callback`
   - Production: `https://your-app.vercel.app/auth/google/callback`
6. Copy **Client ID** and **Client Secret**

### 2. Deploy to Vercel

```bash
# Install Vercel CLI globally
npm install -g vercel

# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Deploy to Vercel
vercel

# Follow prompts, then deploy to production
vercel --prod
```

### 3. Configure Environment Variables on Vercel

After deployment, add environment variables in Vercel dashboard:

1. Go to your project on [vercel.com](https://vercel.com)
2. Settings → Environment Variables
3. Add the following:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
   - `GOOGLE_REDIRECT_URI`: `https://your-app.vercel.app/auth/google/callback`
   - `JWT_SECRET`: Random secure string (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

4. Redeploy: `vercel --prod`

### 4. Update Electron App

Update the Electron app's login flow to use your Vercel URL:

- Replace `https://api.yourapp.com` with your actual Vercel URL (e.g., `https://ai-pin-backend.vercel.app`)

## Local Development

```bash
# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env and add your credentials
# Use http://localhost:3000/auth/google/callback as redirect URI for local testing

# Install dependencies
npm install

# Start server
npm run dev
```

Visit `http://localhost:3000` to verify server is running.

## Testing OAuth Flow

1. Open browser to: `http://localhost:3000/auth/google/start`
2. Should redirect to Google login
3. After login, redirects to `aifloatingassistant://auth-success?token=...`
4. If Electron app is running with protocol registered, it will open

## Security Notes

- Never commit `.env` file
- Keep `JWT_SECRET` secure and random
- Rotate secrets periodically
- Use HTTPS in production (Vercel provides this automatically)
