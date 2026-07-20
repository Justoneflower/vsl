# Inner Awakening — Admin Backend

A tiny backend so the client can log in, change the event's Date / Time /
Duration / Language, and have it show up for every visitor on the live site.

## What's included

- `server.js` — the whole API (login, password change, read/write event details)
- `package.json` — dependencies
- `.env.example` — settings you fill in before deploying
- `data/store.json` — created automatically the first time the server runs; holds the admin password (hashed) and the current event details

## 1. Deploy the backend

The easiest free option is **Render.com**:

1. Push this `backend` folder to a GitHub repo (or a repo containing it).
2. On Render: **New → Web Service**, connect the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables (from `.env.example`):
   - `JWT_SECRET` — generate one locally with:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ALLOWED_ORIGIN` — your site's domain, e.g. `https://inneraw akeningprogramme.com`
6. Deploy. Render gives you a URL like `https://inner-awakening-admin.onrender.com` — that's your `API_BASE`.

Railway, Fly.io, or a basic VPS work the same way — the code doesn't change, only the deploy steps.

**Note on Render's free tier:** free web services "sleep" after inactivity and take ~30–60 seconds to wake up on the next request. If that delay matters for your client, use a paid tier or a host that doesn't sleep.

## 2. Point the frontend at your backend

Open these three files and replace the placeholder at the top:
```js
const API_BASE = 'https://YOUR-BACKEND-URL.example.com';
```
with your real deployed URL, in:
- `admin-login.html`
- `admin-panel.html`
- `site-integration-snippet.html`

## 3. Wire the snippet into the main site

Follow the instructions inside `site-integration-snippet.html` — paste the
`<script>` block before `</body>` on your main page, and add the four `id`
attributes to your hero info card `<h4>` tags.

## 4. First login

Visit `admin-login.html` on your deployed site. Since no password exists yet,
it'll prompt the client to set one. After that, it behaves like a normal
login screen.

## How it works, in short

- `GET /api/content` is public — this is what every visitor's browser calls to display the current date/time/duration/language. No login needed to read it.
- `PUT /api/content` requires a valid login token — only the admin can change it.
- Passwords are hashed with bcrypt before being stored; the raw password is never saved anywhere.
- Login sessions are JWT tokens that expire after 12 hours, stored in the browser's `sessionStorage` (cleared when the browser tab closes).
- There's a rate limit of 10 login attempts per 15 minutes per IP, to slow down password guessing.

## Local testing

```bash
cd backend
npm install
cp .env.example .env   # then edit .env with a real JWT_SECRET
npm start
```
Server runs at `http://localhost:4000`. Point `API_BASE` at that while testing locally, and switch `ALLOWED_ORIGIN` to `*` temporarily if you're serving the frontend from a different local port.
