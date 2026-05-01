// api/auth/github-callback.js
const axios = require('axios');
const { createSession, getSession, sessionCookie, cors } = require('../../lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, error } = req.query;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  if (error) return res.writeHead(302, { Location: `${appUrl}?error=github_denied` }).end();

  try {
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${appUrl}/api/auth/github-callback`,
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token } = tokenRes.data;

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}`, Accept: 'application/vnd.github.v3+json' },
    });

    const existing = getSession(req);
    const tokens = existing?.tokens || {};
    tokens.github = {
      access_token,
      username: userRes.data.login,
      name: userRes.data.name,
    };

    const session = createSession(tokens);
    res.setHeader('Set-Cookie', sessionCookie(session));
    res.writeHead(302, { Location: `${appUrl}?connected=github` });
    res.end();
  } catch (e) {
    console.error('GitHub callback error:', e.message);
    res.writeHead(302, { Location: `${appUrl}?error=github_failed` });
    res.end();
  }
};
