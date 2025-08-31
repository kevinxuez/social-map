import { handleAuth } from '@auth0/nextjs-auth0';

// The v4 quickstart uses APP_BASE_URL & AUTH0_DOMAIN etc; map to expected names if needed
if (process.env.APP_BASE_URL && !process.env.AUTH0_BASE_URL) {
  (process as any).env.AUTH0_BASE_URL = process.env.APP_BASE_URL;
}
if (process.env.AUTH0_DOMAIN && !process.env.AUTH0_ISSUER_BASE_URL) {
  (process as any).env.AUTH0_ISSUER_BASE_URL = `https://${process.env.AUTH0_DOMAIN}`;
}

export const GET = handleAuth();
export const POST = handleAuth();
