# Copilot Instructions for Social Map

## Project Overview
- **Monorepo** for a social-network-mapping web app.
- Two main apps:
  - **Backend** (`apps/backend`): FastAPI, SQLAlchemy, Alembic, PostgreSQL/PostGIS, Redis.
  - **Frontend** (`apps/frontend`): Next.js, React, Mapbox GL, React Force Graph.
- Uses Docker Compose for local dev: PostGIS and Redis services.

## Architecture & Data Flow
- **Backend** exposes REST API endpoints (see `app/api/routes.py`).
  - `/entities`, `/graph` are key endpoints for entity CRUD and graph data.
  - CORS configured for frontend dev (`http://localhost:3000`).
  - DB session via `app/db/session.py`; models in `app/models/models.py`.
- **Frontend** consumes backend via `src/lib/api.ts` (uses `NEXT_PUBLIC_API_BASE` env var).
  - Graph page (`src/app/graph/page.tsx`) visualizes data from `/graph` endpoint using React Force Graph.
  - (Map page removed; project now focuses solely on graph.)
  - Navigation in `src/components/Nav.tsx`.

## Developer Workflows
- **Backend**:
  - Dev: `npm run dev` (activates venv, runs Uvicorn with reload)
  - Start: `npm start`
  - Python dependencies in `requirements.txt`; Node scripts in `package.json` (for dev convenience)
  - Alembic migrations: see `alembic/` folder
- **Frontend**:
  - Dev: `npm run dev` (Next.js on port 3000)
  - Build: `npm run build`
  - Lint: `npm run lint`
  - Uses TypeScript, Tailwind CSS, React Query
- **Docker Compose**: `docker-compose up` starts PostGIS and Redis for local dev

## Conventions & Patterns
- **API**: All backend endpoints return JSON; errors are thrown with text bodies.
- **Frontend**: API calls always include credentials; environment variables control API base and Mapbox token.
- **Monorepo**: Each app has its own `package.json` and environment files.
- **Auth**: Frontend uses Auth0 (`@auth0/nextjs-auth0`); login/logout via `/api/auth/*` routes.
- **Graph/Map**: Graph data is node/link format; map data is GeoJSON.

## Integration Points
- **Frontend <-> Backend**: API base URL set via `NEXT_PUBLIC_API_BASE` (must match backend host/port).
- **Database**: PostgreSQL with PostGIS; migrations via Alembic.
- **Redis**: Used for caching/session (see backend code for usage).
- **Mapbox**: Requires `NEXT_PUBLIC_MAPBOX_TOKEN` in frontend env.

## Key Files & Directories
- `apps/backend/app/api/routes.py`: Main API endpoints
- `apps/backend/app/models/models.py`: DB models
- `apps/backend/app/db/session.py`: DB session setup
- `apps/frontend/src/lib/api.ts`: API client
- `apps/frontend/src/app/graph/page.tsx`: Graph visualization
<!-- Map visualization removed -->
- `docker-compose.yml`: Service definitions

## Example Patterns
- **API call (frontend)**:
  ```ts
  api<{ nodes: Node[]; links: Link[] }>(`/graph?entity_id=1`)
  ```
- **Backend endpoint (FastAPI)**:
  ```python
  @router.get('/graph')
  def get_graph(...):
      ...
  ```

---
_If any section is unclear or missing, please provide feedback to improve these instructions._
