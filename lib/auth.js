// lib/auth.js — JWT session helpers
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'meridian-dev-secret';
const COOKIE_NAME = 'meridian_session';

function createSession(tokens) {
  return jwt.sign({ tokens }, SECRET, { expiresIn: '7d' });
}

function getSession(req) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
    );
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`;
}

function cors(res) {
  const appUrl = process.env.APP_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', appUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify(data));
}

module.exports = { createSession, getSession, sessionCookie, clearCookie, cors, json };
