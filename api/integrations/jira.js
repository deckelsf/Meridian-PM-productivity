// api/auth/jira.js — Atlassian/Jira OAuth 2.0
const { cors } = require('../../lib/auth');

const SCOPES = [
  'read:jira-work',
  'read:jira-user',
  'write:jira-work',
  'offline_access',
].join(' ');

module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.JIRA_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'JIRA_CLIENT_ID not configured' });

  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = `${appUrl}/api/auth/jira-callback`;

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64'),
    response_type: 'code',
    prompt: 'consent',
  });

  res.writeHead(302, { Location: `https://auth.atlassian.com/authorize?${params}` });
  res.end();
};
