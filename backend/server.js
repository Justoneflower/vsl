require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-deploying';
const DATA_FILE = path.join(__dirname, 'data', 'store.json');

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// ---------- storage helpers ----------
// Data lives in a single JSON file on disk. Fine for one small site with
// one admin. If this ever needs multiple admins or higher traffic, swap
// readStore/writeStore for a real database — every route below stays the same.
function readStore() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      passwordHash: null,
      content: {
        date: '25 July 2026',
        time: '9:30 AM \u2013 12:30 PM',
        duration: '3 Hours',
        language: 'English & Hindi',
      },
    };
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------- auth middleware ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- routes ----------

// health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// public: does an admin password already exist?
// (frontend uses this to decide whether to show "set up password" or "log in")
app.get('/api/auth/status', (req, res) => {
  const store = readStore();
  res.json({ hasPassword: !!store.passwordHash });
});

// first-time setup — only works once, before any password exists
app.post('/api/auth/set-password', async (req, res) => {
  const store = readStore();
  if (store.passwordHash) {
    return res.status(400).json({ error: 'A password is already set. Please log in instead.' });
  }
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  store.passwordHash = await bcrypt.hash(password, 10);
  writeStore(store);
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const store = readStore();
  if (!store.passwordHash) {
    return res.status(400).json({ error: 'No password set yet. Please complete setup first.' });
  }
  const { password } = req.body || {};
  const ok = password && (await bcrypt.compare(password, store.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Incorrect password.' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// change password — requires a valid session
app.put('/api/auth/password', requireAuth, async (req, res) => {
  const store = readStore();
  const { currentPassword, newPassword } = req.body || {};
  const ok = currentPassword && (await bcrypt.compare(currentPassword, store.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  store.passwordHash = await bcrypt.hash(newPassword, 10);
  writeStore(store);
  res.json({ success: true });
});

// public: read current event details — this is what the LIVE SITE fetches
// for every visitor, so it must stay unauthenticated.
app.get('/api/content', (req, res) => {
  const store = readStore();
  res.json(store.content);
});

// protected: update event details — only the logged-in admin can call this
app.put('/api/content', requireAuth, (req, res) => {
  const store = readStore();
  const { date, time, duration, language } = req.body || {};
  store.content = {
    date: (date || store.content.date).toString().trim(),
    time: (time || store.content.time).toString().trim(),
    duration: (duration || store.content.duration).toString().trim(),
    language: (language || store.content.language).toString().trim(),
  };
  writeStore(store);
  res.json(store.content);
});

app.listen(PORT, () => {
  console.log(`Inner Awakening admin backend running on port ${PORT}`);
});
