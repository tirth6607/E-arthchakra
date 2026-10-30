# E-arthchakra — Vercel + MongoDB

```
public/        your frontend (HTML/CSS/JS) + api.js (new API client)
api/           Vercel serverless functions
  auth/[action].js  ONE function for all /api/auth/* URLs (Hobby plan: max 12 functions)
                    handlers live in lib/auth-routes/: register, login, logout, me, forgot-password,
                    resend-reset-code, verify-reset-code, reset-password
  pickups/     index.js (list/create), [id].js (admin/partner update, partner accept)
  partners.js  admin: list partners, approve/suspend
  enquiries.js contact form (POST public, GET admin)
lib/ models/   DB connection, auth, Mongoose schemas
scripts/seed.js creates the admin account (partners self-register)
```

## 1. MongoDB Atlas
1. Create a free cluster at https://cloud.mongodb.com.
2. Database Access → add a user (username + password).
3. Network Access → add `0.0.0.0/0` (Vercel uses changing IPs).
4. Connect → Drivers → copy the connection string, put `/ecoflow` before the `?`.

## 2. Run locally
```bash
npm install
cp .env.example .env        # fill in MONGODB_URI, JWT_SECRET, admin details
npm run seed                # creates the admin user
npm i -g vercel
vercel dev                  # http://localhost:3000
```

## 3. Deploy
```bash
vercel                      # first deploy (link the project)
vercel env add MONGODB_URI  # Production (and Preview if you like)
vercel env add JWT_SECRET
vercel env add RESEND_API_KEY   # password reset emails
vercel env add EMAIL_FROM
vercel --prod
```
Or push to GitHub and import the repo in the Vercel dashboard (add the two env vars under Settings → Environment Variables).
Run `npm run seed` once locally against your Atlas URI to create the admin login. Partners sign up at `partner-register.html` and the admin approves them under Collection Partners.

## Roles
| Role | Can do |
|---|---|
| customer | register, create pickups, see only their own pickups |
| admin | see all pickups, change status, assign partner, set schedule, read enquiries |
| partner | self-register (starts pending); once approved, see open Pending requests and accept them, see pickups assigned to their `partnerName`, set In Progress / Completed |

## What changed in the frontend
- New `public/api.js` replaces every `localStorage` "database" call.
- login / register / pickup / contact / dashboard / admin / partner now call `/api/...`.
- `localStorage.earthchakra_user` is kept only as a UI hint (name, role). The real session is an httpOnly cookie, and every API route re-checks the role.
- Admin/partner polling slowed from 3s to 15s to avoid hammering the database.
- Login has a new **Partner** tab. The admin "any email works" demo login is gone.

## Waste reports (photo + GPS)
- Page `public/report.html` -> `POST /api/reports` -> photo in Vercel Blob (URL + key saved in MongoDB) -> `WasteReport`.
- Pickup requests are a separate system: `POST /api/pickups`.
- Admin: **Scrap Reports** tab in `public/admin.html`.

## Forgot password
Flow: `login.html` → `forgot-password.html` → `verify-reset-code.html` → `reset-password.html` → back to login with the same email and the new password.

- Emails go through [Resend](https://resend.com). Set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain you verified in Resend).
- Local testing without Resend: set `EMAIL_DEV_CONSOLE=1` in `.env` and the email (with the code) prints in the `vercel dev` terminal. This is ignored on Vercel.
- Codes: 6 digits from `crypto.randomInt`, valid for 10 minutes, 5 wrong tries, stored only as HMAC hashes in the `passwordresets` collection (cleaned up automatically by a TTL index).
- Limits (kept in the `ratelimits` collection): 1 code per email per 60 s, 3 per email per 15 min, 10 per IP per 15 min; 20 code checks and 10 resets per IP per 15 min.
- A reset signs out every existing session for that account (`User.passwordChangedAt`).
