// server.js - OAuth Backend for AI Floating Assistant
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory state store (for demo - use Redis in production)
const stateStore = new Map();

// Cleanup old states (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      stateStore.delete(state);
    }
  }
}, 60 * 1000);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'AI Floating Assistant OAuth Backend',
    timestamp: new Date().toISOString()
  });
});

// STEP 1: Start OAuth Flow
app.get('/auth/google/start', (req, res) => {
  try {
    // Generate secure random state
    const state = crypto.randomUUID();
    
    // Store state with timestamp
    stateStore.set(state, {
      timestamp: Date.now(),
      ip: req.ip
    });

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account'
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    console.log('[OAuth Start] State:', state);
    res.redirect(googleAuthUrl);
  } catch (error) {
    console.error('[OAuth Start Error]', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// STEP 2: Handle OAuth Callback
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  try {
    // Handle user-cancelled flow
    if (error) {
      console.log('[OAuth Cancelled]', error);
      return res.redirect(`aifloatingassistant://auth-error?error=${error}`);
    }

    // Validate state (CSRF protection)
    if (!state || !stateStore.has(state)) {
      console.error('[OAuth Error] Invalid state:', state);
      return res.status(400).send('Invalid state parameter. Please try again.');
    }

    // Clean up used state
    stateStore.delete(state);

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[Google Token Error]', errorData);
      return res.status(500).send('Failed to exchange token with Google');
    }

    const tokens = await tokenResponse.json();
    
    // Decode ID token (JWT) to get user info
    const idToken = tokens.id_token;
    const userInfo = jwt.decode(idToken); // No verification needed, already from Google

    console.log('[OAuth Success] User:', userInfo.email);

    // Create YOUR app's session token
    const appToken = jwt.sign(
      {
        userId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Redirect back to Electron app with token
    res.redirect(`aifloatingassistant://auth-success?token=${appToken}`);
    
  } catch (error) {
    console.error('[OAuth Callback Error]', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// Verify token endpoint (optional - for frontend to validate)
app.post('/auth/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ 
      valid: true, 
      user: {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      }
    });
  } catch (error) {
    res.json({ valid: false, error: 'Invalid token' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 OAuth Backend running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for Vercel serverless
module.exports = app;
