// apps/frontend/src/pages/api/auth/[...auth0].ts
import { handleAuth } from '@auth0/nextjs-auth0';

// Simplified auth route: no automatic entity creation; users start with empty graph.
export default handleAuth();