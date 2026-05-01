// api/integrations/slack.js — Fetch real Slack data
const axios = require('axios');
const { getSession, cors, json } = require('../../lib/auth');

async function slackGet(path, token, params = {}) {
  const res = await axios.get(`https://slack.com/api/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  if (!res.data.ok) throw new Error(res.data.error || `Slack ${path} failed`);
  return res.data;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = getSession(req);
  if (!session?.tokens?.slack) return json(res, 401, { error: 'Slack not connected' });

  const token = session.tokens.slack.access_token;
  const { action } = req.query;

  try {
    if (action === 'channels') {
      // Get joined channels
      const data = await slackGet('conversations.list', token, {
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 20,
      });

      // Get unread counts and latest message for each channel
      const channels = await Promise.all(
        data.channels.slice(0, 10).map(async (ch) => {
          try {
            const history = await slackGet('conversations.history', token, {
              channel: ch.id, limit: 5,
            });
            const msgs = history.messages || [];
            const unread = msgs.filter(m => !m.bot_id).length;
            return {
              id: ch.id,
              name: `#${ch.name}`,
              unread,
              latest: msgs[0]?.text?.slice(0, 120) || '',
              memberCount: ch.num_members,
            };
          } catch {
            return { id: ch.id, name: `#${ch.name}`, unread: 0, latest: '', memberCount: 0 };
          }
        })
      );

      return json(res, 200, { channels: channels.filter(c => c.unread > 0 || c.name.includes('product')) });
    }

    if (action === 'send') {
      if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
      let body = '';
      req.on('data', d => body += d);
      await new Promise(r => req.on('end', r));
      const { channel, text } = JSON.parse(body);

      await slackGet('chat.postMessage', token, {});
      const sendRes = await axios.post('https://slack.com/api/chat.postMessage', {
        channel, text,
      }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

      if (!sendRes.data.ok) throw new Error(sendRes.data.error);
      return json(res, 200, { ok: true, ts: sendRes.data.ts });
    }

    if (action === 'dms') {
      const dms = await slackGet('conversations.list', token, {
        types: 'im', limit: 10,
      });

      const dmData = await Promise.all(
        dms.channels.slice(0, 5).map(async (dm) => {
          try {
            const [history, userInfo] = await Promise.all([
              slackGet('conversations.history', token, { channel: dm.id, limit: 3 }),
              slackGet('users.info', token, { user: dm.user }),
            ]);
            return {
              id: dm.id,
              user: userInfo.user?.real_name || dm.user,
              messages: history.messages?.slice(0, 3).map(m => ({
                text: m.text?.slice(0, 100),
                ts: m.ts,
              })) || [],
            };
          } catch { return null; }
        })
      );

      return json(res, 200, { dms: dmData.filter(Boolean) });
    }

    json(res, 400, { error: 'Unknown action. Use: channels, send, dms' });
  } catch (e) {
    console.error('Slack error:', e.message);
    json(res, 500, { error: e.message });
  }
};
