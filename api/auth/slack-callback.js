// api/auth/slack-callback.js — Handle Slack OAuth callback
const axios = require('axios');
const { createSession, getSession, sessionCookie, cors, json } = require('../../lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, error } = req.query;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  if (error) {
    return res.writeHead(302, { Location: `${appUrl}?error=slack_denied` }).end();
  }

  try {
    const redirectUri = `${appUrl}/api/auth/slack-callback`;
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      },
    });

    const data = response.data;
    if (!data.ok) throw new Error(data.error || 'Slack auth failed');

    // Merge with existing session tokens
    const existing = getSession(req);
    const tokens = existing?.tokens || {};
    tokens.slack = {
      access_token: data.access_token,
      team: data.team,
      bot_user_id: data.bot_user_id,
      authed_user: data.authed_user,
    };

    const session = createSession(tokens);
    res.setHeader('Set-Cookie', sessionCookie(session));
    res.writeHead(302, { Location: `${appUrl}?connected=slack` });
    res.end();
  } catch (e) {
    console.error('Slack callback error:', e.message);
    res.writeHead(302, { Location: `${appUrl}?error=slack_failed` });
    res.end();
  }
};
