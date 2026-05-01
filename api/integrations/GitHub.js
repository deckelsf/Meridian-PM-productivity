// api/auth/github.js
const { cors } = require('../../lib/auth');

module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });

  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = `${appUrl}/api/auth/github-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo,read:user,read:org',
    state: Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64'),
  });

  res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?${params}` });
  res.end();
};
