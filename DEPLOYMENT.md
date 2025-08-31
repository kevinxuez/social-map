# Production Deployment (Single VM + Caddy + Docker Compose)

Context snapshot:
Monorepo: apps/backend (FastAPI, SQLAlchemy, Alembic, Postgres/PostGIS, Redis), apps/frontend (Next.js/React)
Entities, groups (hierarchical), undirected edges, Auth0, Redis caching + rate limit, CSV import/export.

This file mirrors the automated files added to support production launch.

## Files Added
- apps/backend/Dockerfile
- apps/frontend/Dockerfile
- docker-compose.prod.yml
- Caddyfile
- .env.prod.backend.example
- .env.prod.frontend.example
- .github/workflows/deploy.yml
- DEPLOYMENT.md (this document)

## Steps Overview
1. Provision Ubuntu VM + DNS
2. Install Docker / Compose plugin
3. Clone repo to /opt/social-map
4. Copy env example files to real .env.prod.backend / .env.prod.frontend with secrets
5. Edit Caddyfile domain + email
6. Run compose: docker compose -f docker-compose.prod.yml up -d --build
7. Verify https://yourdomain.com and /api/healthz
8. Configure GitHub Actions secrets for push-to-deploy

## Required GitHub Secrets
- DEPLOY_HOST (VM IP or hostname)
- DEPLOY_USER (SSH user with docker perms)
- DEPLOY_SSH_KEY (private key contents)
- REPO_CLONE_URL (ssh or https clone URL)

## Rollback
Checkout prior commit and re-run compose build.

---
Production ready when: HTTPS green lock, login works, graph loads, position saves persist, rate limiting enforced, redeploy via GitHub push.
