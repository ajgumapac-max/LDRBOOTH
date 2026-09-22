# LDRBOOTH

Two places. One photobooth.

LDRBOOTH is a mobile-first, browser-based photobooth for two people who are
in different locations. One person creates a booth, the other joins with a
code, they see each other's cameras live, take a synchronized set of shots,
pick their favorites together, arrange a final layout, choose a look, pay,
and both get their own private download link by email.

This is a **fresh build** — not a migration of an existing codebase — following
the general two-person-photobooth product experience as a shape (create/join a
room, live cameras, synchronized capture, pick favorites, build a layout,
choose a style, pay, deliver), with its own original visual identity,
copy, illustrations, and code.

---

## 1. Architecture

```
 Phone / laptop                Phone / laptop
        \                             /
         \                           /
          v                         v
        ┌───────────────────────────────┐
        │   Vercel — React + Vite        │
        │   (frontend)                   │
        └───────────────┬────────────────┘
                         │ HTTPS / WSS
                         v
        ┌───────────────────────────────┐
        │  Render — Node + Express       │
        │  + Socket.IO (backend)         │
        └───────┬───────────────┬────────┘
                 │               │
                 v               v
        ┌───────────────┐ ┌───────────────┐
        │ Supabase       │ │ Supabase      │
        │ PostgreSQL     │ │ Storage       │
        └───────────────┘ └───────────────┘

 Live video: direct peer-to-peer WebRTC between the two browsers.
 Socket.IO only relays signaling + session/game state (ready, capture
 rounds, selections, layout, style, payment) — never video frames.
```

- **Frontend** — React + Vite, mobile-first responsive CSS (no fixed desktop
  widths), Socket.IO client, WebRTC.
- **Backend** — Node + Express + Socket.IO. Server-authoritative: capture
  rounds, selection matching, and payment confirmation are all decided on
  the server, never trusted from a single client.
- **Database** — Supabase PostgreSQL for durable records (booths,
  participants, selections, layouts, payments, deliveries). See
  `database/schema.sql`.
- **Storage** — Supabase Storage, private buckets, signed URLs that expire
  in 1 hour.
- **Email** — pluggable service (console logging in dev, SMTP in
  production).
- **Payment** — mock GCash-style flow for development; a real gateway is a
  clearly-marked integration point, not faked.

---

## 2. Project structure

```
LDRBOOTH/
  frontend/
    src/
      components/     screen-level React components
      services/        socket.js, api.js, webrtc.js
      data/            poses.js, formats.js, styles.js
      utils/           canvasRender.js (shot compositing + final image export)
      App.jsx           screen state machine
      App.css           mobile-first styling
      main.jsx
    package.json
    .env.example
  backend/
    server.js           Express + Socket.IO, all event handlers + HTTP API
    services/
      supabaseClient.js
      db.js              thin Supabase table helpers
      email.js           console / SMTP
      payment.js         mock / live switch
      storage.js         Supabase Storage upload + signed URLs
      boothStore.js      in-memory live session state
    utils/poses.js
    package.json
    .env.example
  database/
    schema.sql
  README.md (this file)
```

---

## 3. Local development

### Backend

```bash
cd backend
cp .env.example .env      # fill in Supabase creds if you have a project; optional for local testing
npm install
npm start                 # or: npm run dev (auto-restarts on change)
```

The server listens on `0.0.0.0:$PORT` (default 3001). Without Supabase
configured, it still runs — sockets and the whole booth flow work locally,
persistence just no-ops with a console warning (see the honesty note in
§7 below).

### Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

Vite is configured with `host: true`, so during dev you can also open the
printed "Network" URL from a phone on the same Wi-Fi to test the mobile
layout on a real device.

### Testing with two people (two browsers)

1. Open the frontend in **Browser 1** → Create a booth → note the code.
2. Open the frontend in **Browser 2** (a different browser, or an incognito
   window — two tabs of the same logged-in browser session will still
   work, since there's no auth, but two distinct browser *contexts* make
   camera permissions cleaner) → Join a booth → enter the code.
3. Allow camera access in both.
4. Walk through: format → ready → 10 synchronized shots → pick 4 favorites
   each → reorder → pick a style → preview → mock payment → delivery.
5. With `EMAIL_MODE=console` (the default), the "sent" email and its link
   print to the **backend terminal** instead of an inbox.

---

## 4. Supabase setup (for persistence + storage)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `database/schema.sql`.
3. Under **Storage**, create two **private** buckets: `shots` and
   `final-photos`. Do not make them public — the backend serves access
   exclusively through signed URLs that expire after 1 hour.
4. Copy your project URL, anon key, and **service role key** into
   `backend/.env`.
   - `SUPABASE_SERVICE_ROLE_KEY` is server-side only. Never put it in the
     frontend's `.env` or ship it to the browser.
5. Row Level Security is enabled on every table with no policies, so only
   the service-role key (used exclusively by the backend) can read/write.

---

## 5. Deployment

### Backend → Render

- New **Web Service**, root directory `backend/`.
- Build command: `npm install`. Start command: `npm start`.
- Environment variables: everything in `backend/.env.example`, with
  `FRONTEND_ORIGIN` set to your actual Vercel domain (comma-separate if
  you need more than one, e.g. a preview + production URL).
- The server already binds to `0.0.0.0`, which Render requires.

### Frontend → Vercel

- New project, root directory `frontend/`.
- Framework preset: Vite.
- Environment variable: `VITE_API_URL=https://your-backend.onrender.com`.
- Never leave `VITE_API_URL` pointing at `localhost` in production.

### CORS

`backend/server.js` restricts Socket.IO and the HTTP API to
`FRONTEND_ORIGIN`. Update it to your real Vercel domain before going live;
don't leave it as `*` once credentials/security matter.

---

## 6. Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full,
commented list. Highlights:

| Variable | Where | Notes |
|---|---|---|
| `VITE_API_URL` | frontend | backend URL, never `localhost` in prod |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only | never expose to the browser |
| `EMAIL_MODE` | backend | `console` (dev) or `smtp` (prod) |
| `PAYMENT_MODE` | backend | `mock` (dev/test) — `live` is an unimplemented placeholder, see `services/payment.js` |

---

## 7. Status — what's actually done vs. what still needs you

Per the brief: no overclaiming. Here's the honest breakdown.

**IMPLEMENTED**
- Mobile-first responsive UI (stacked cameras on mobile, side-by-side on
  desktop; no fixed widths; large touch targets)
- Create / join booth flow with named-participant profile step up front
- Server-authoritative room state (max 2 participants, room codes,
  expiry)
- WebRTC live video, peer-to-peer, with Socket.IO signaling relay only
- Server-driven synchronized capture (10 configurable rounds), with
  original pose illustrations (simple SVG, not photorealistic, not
  scraped)
- Photo selection with live partner-visibility and server-side
  set-based match detection (order-independent)
- Layout reordering (touch-friendly up/down controls)
- Style/filter presets applied via the same render path used for both
  preview and the exported image (Canvas-based, not a screenshot)
- Mock GCash-style payment, either participant can pay, server-confirmed
- Per-participant private delivery: signed 1-hour Supabase Storage URL +
  email, each person only ever sees their own link/email
- Print stylesheet that isolates just the final photo

**TESTED**
- Local two-browser create/join, WebRTC connection, and a full run
  through every screen with `EMAIL_MODE=console` / `PAYMENT_MODE=mock`
  and no Supabase project configured (i.e. sockets + in-memory session
  logic only)
- `npm run build` (frontend) and a backend boot smoke-test, both pass
  cleanly

**NOT TESTED**
- Real two-device testing over the internet (two phones on different
  networks) — only local/same-machine two-browser testing was done here
- Cross-browser quirks on real iOS Safari vs. Chrome Android hardware
  (built to standard responsive/WebRTC practices, but not verified on
  physical devices)
- Behavior under packet loss / flaky mobile connections during a live
  capture session

**REQUIRES EXTERNAL SERVICE / YOUR CONFIGURATION**
- An actual Supabase project (schema + storage buckets) for real
  persistence and signed delivery URLs — without it the app still runs
  end-to-end locally, it just doesn't durably save anything
- A real SMTP/Resend/SendGrid account for `EMAIL_MODE=smtp`
- A real, legitimate GCash-compatible payment gateway integration —
  `PAYMENT_MODE=live` is an intentional stub that throws rather than
  fake-verifying a payment (see `backend/services/payment.js`)
- Deployed Render + Vercel domains, and CORS/`VITE_API_URL` pointed at
  them

---

## 8. Notes on a few design decisions

- **Pose references** are original, simple two-figure SVG illustrations
  generated in code (`components/PoseIllustration.jsx`) rather than photos
  — deliberately not photorealistic, per the brief.
- **Canonical shot image**: both participants' browsers composite their
  own view of a capture round (their camera + the partner's incoming
  WebRTC stream) onto a canvas independently; the server treats the
  creator's copy as canonical for consistency, and only advances once both
  sides have confirmed a capture, so the session never gets ahead of a
  slow connection.
- **Format vs. style are synced for both people** (server broadcasts);
  **layout order** is collaboratively editable by either person, with
  last-write-wins — simple and fine for a two-person, few-photo session.
