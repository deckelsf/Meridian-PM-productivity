// api/auth/google-callback.js
const axios = require('axios');
const { createSession, getSession, sessionCookie, cors } = require('../../lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, error } = req.query;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  if (error) {
    return res.writeHead(302, { Location: `${appUrl}?error=google_denied` }).end();
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google-callback`;
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Get user profile
    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const existing = getSession(req);
    const tokens = existing?.tokens || {};
    tokens.google = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
      email: profileRes.data.email,
      name: profileRes.data.name,
    };

    const session = createSession(tokens);
    res.setHeader('Set-Cookie', sessionCookie(session));
    res.writeHead(302, { Location: `${appUrl}?connected=google` });
    res.end();
  } catch (e) {
    console.error('Google callback error:', e.message);
    res.writeHead(302, { Location: `${appUrl}?error=google_failed` });
    res.end();
  }
};
