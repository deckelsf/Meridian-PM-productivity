// api/auth/session.js — Return which integrations are connected
const { getSession, cors, json } = require('../../lib/auth');

module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = getSession(req);
  if (!session) return json(res, 200, { connected: [] });

  const tokens = session.tokens || {};
  const connected = Object.keys(tokens).filter(k => tokens[k]?.access_token);

  // Return safe metadata (no tokens)
  const info = {};
  if (tokens.slack) info.slack = { team: tokens.slack.team?.name };
  if (tokens.google) info.google = { email: tokens.google.email, name: tokens.google.name };
  if (tokens.jira) info.jira = { site: tokens.jira.site_name, url: tokens.jira.site_url };
  if (tokens.github) info.github = { username: tokens.github.username };

  json(res, 200, { connected, info });
};
