# Social Map

## Overview
 Users can log in and edit a people-and-groups network graph. Everyone sees and edits the same shared graph (no user-specific data).

## Core Features
- Auth0 login/logout (Next.js, `@auth0/nextjs-auth0`).
- Global graph view with pan/zoom, node dragging, and group hulls.
- Shared graph data model for all users (PostgreSQL + PostGIS).
- Create, edit, and delete people and edges ("entities").
- Create group hierarchies; adjusting entity groups when they change memberships.

## Tech Stack
| Layer      | Tech |
|------------|------|
| Frontend   | Next.js , React, TypeScript, Tailwind, React Force Graph |
| Auth       | Auth0 Service |
| Backend    | FastAPI, Uvicorn, SQLAlchemy, Alembic |
| Database   | PostgreSQL + PostGIS image (spatial ready) |
| Cache      | Redis |
| Deployment | Docker Compose + Caddy on AWS EC2 instance |


## Deployment Notes
- Deployed to "kevin-xue.com" on an AWS EC2 instance.
- Email Login/Logout does not check for specific emails/verify, just basic email format.
- I didn't read the dev doc too deeply so I accidentally bought a domain (free personal website domain ig LOL)
- I used `docker-compose.prod.yml` to build both services + Caddy.
- `Caddyfile` handles HTTPS & routing for me.
- Use separate persistent volumes for Postgres (`pgdata`).

