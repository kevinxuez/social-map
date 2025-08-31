# Social Map

Monorepo for a social-network-mapping web app.

Local running:

# Backend (in a new terminal)
cd C:\Users\kevin\apenn2028\pennsparkred\social-map\apps\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd C:\Users\kevin\apenn2028\pennsparkred\social-map\apps\frontend
npm run dev

## Auth0 Setup

1. Create a Regular Web Application in Auth0.
2. Callback URL: `http://localhost:3000/auth/callback`
3. Logout URL: `http://localhost:3000`
4. Web Origin & CORS Origin: `http://localhost:3000`
5. Copy `.env.example` to `.env.local` in `apps/frontend` and fill:
```
NEXT_PUBLIC_API_BASE=http://localhost:8000
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=YOUR_TENANT.us.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_SECRET=<openssl rand -hex 32>
```
6. Restart `npm run dev`.

Login: `/auth/login`  Logout: `/auth/logout`