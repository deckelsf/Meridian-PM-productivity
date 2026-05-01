// api/integrations/google.js — Calendar events + Gmail threads
const axios = require('axios');
const { getSession, cors, json, createSession, sessionCookie } = require('../../lib/auth');

async function refreshGoogleToken(tokens, res) {
  if (!tokens.google?.refresh_token) return tokens;
  if (Date.now() < (tokens.google.expires_at || 0) - 60000) return tokens; // still valid

  try {
    const r = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.google.refresh_token,
      grant_type: 'refresh_token',
    });
    tokens.google.access_token = r.data.access_token;
    tokens.google.expires_at = Date.now() + r.data.expires_in * 1000;
    // Refresh session cookie
    const newSession = createSession(tokens);
    res.setHeader('Set-Cookie', sessionCookie(newSession));
  } catch (e) {
    console.error('Token refresh failed:', e.message);
  }
  return tokens;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = getSession(req);
  if (!session?.tokens?.google) return json(res, 401, { error: 'Google not connected' });

  let tokens = await refreshGoogleToken(session.tokens, res);
  const gToken = tokens.google.access_token;
  const { action } = req.query;

  const gHeaders = { Authorization: `Bearer ${gToken}` };

  try {
    // ── CALENDAR ─────────────────────────────────────────
    if (action === 'calendar') {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59);

      const r = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        headers: gHeaders,
        params: {
          timeMin: now.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 10,
        },
      });

      const events = r.data.items.map(e => ({
        id: e.id,
        title: e.summary || '(No title)',
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location,
        meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri,
        attendees: e.attendees?.slice(0, 5).map(a => a.email) || [],
        description: e.description?.slice(0, 200),
        isAllDay: !e.start?.dateTime,
      }));

      return json(res, 200, { events });
    }

    // ── UPCOMING (next 7 days) ────────────────────────────
    if (action === 'upcoming') {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

      const r = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        headers: gHeaders,
        params: {
          timeMin: now.toISOString(),
          timeMax: nextWeek.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 20,
        },
      });

      return json(res, 200, { events: r.data.items.map(e => ({
        id: e.id,
        title: e.summary || '(No title)',
        start: e.start?.dateTime || e.start?.date,
        attendees: (e.attendees || []).length,
      })) });
    }

    // ── GMAIL ─────────────────────────────────────────────
    if (action === 'gmail') {
      const listRes = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: gHeaders,
        params: { maxResults: 15, labelIds: 'INBOX', q: 'is:unread' },
      });

      const messages = listRes.data.messages || [];
      const threads = await Promise.all(
        messages.slice(0, 8).map(async msg => {
          const detail = await axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
            { headers: gHeaders, params: { format: 'metadata', metadataHeaders: 'From,Subject,Date' } }
          );
          const headers = detail.data.payload?.headers || [];
          const get = name => headers.find(h => h.name === name)?.value || '';
          return {
            id: msg.id,
            from: get('From'),
            subject: get('Subject'),
            date: get('Date'),
            snippet: detail.data.snippet?.slice(0, 120),
          };
        })
      );

      return json(res, 200, { threads });
    }

    // ── SEND EMAIL ────────────────────────────────────────
    if (action === 'send' && req.method === 'POST') {
      let body = '';
      req.on('data', d => body += d);
      await new Promise(r => req.on('end', r));
      const { to, subject, text } = JSON.parse(body);

      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        text,
      ].join('\n');

      const encoded = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        raw: encoded,
      }, { headers: { ...gHeaders, 'Content-Type': 'application/json' } });

      return json(res, 200, { ok: true });
    }

    json(res, 400, { error: 'Unknown action. Use: calendar, upcoming, gmail, send' });
  } catch (e) {
    console.error('Google error:', e.message);
    json(res, 500, { error: e.message });
  }
};
