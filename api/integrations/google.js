// api/auth/google.js — Start Google OAuth (Calendar + Gmail)
const { cors } = require('../../lib/auth');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'profile',
  'email',
].join(' ');

module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });

  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = `${appUrl}/api/auth/google-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64'),
  });

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
};
